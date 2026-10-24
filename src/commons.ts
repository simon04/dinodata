import { createGlobalState } from "@vueuse/core";
import { ref } from "vue";
import { cachedFetch } from "./cache";

const API = "https://commons.wikimedia.org/w/api.php";

export interface ImageInfo {
  /** thumbnail fitting the requested size */
  url: string;
  width: number;
  height: number;
  descriptionUrl: string;
  artist?: string;
  license?: string;
}

/** HTML from extmetadata as plain text */
const text = (html?: string) =>
  html
    ? new DOMParser()
        .parseFromString(html, "text/html")
        .body.textContent?.trim()
    : undefined;

/** Thumbnail URL (fitting `width`×`height`), author and license of a Commons file. */
export async function getImageInfo(
  file: string,
  width: number,
  height: number,
): Promise<ImageInfo | undefined> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(width),
    iiurlheight: String(height),
    iiextmetadatafilter: "Artist|LicenseShortName",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json: {
    query: {
      pages: {
        imageinfo?: {
          thumburl: string;
          thumbwidth: number;
          thumbheight: number;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string }>;
        }[];
      }[];
    };
  } = await res.json();
  const info = json.query.pages[0]?.imageinfo?.[0];
  if (!info) return undefined;
  return {
    url: info.thumburl,
    width: info.thumbwidth,
    height: info.thumbheight,
    descriptionUrl: info.descriptionurl,
    artist: text(info.extmetadata?.Artist?.value),
    license: text(info.extmetadata?.LicenseShortName?.value),
  };
}

async function query<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();
  return JSON.parse(
    await cachedFetch(url.toString(), {
      cacheName: "commons",
      maxAge: 60 * 60 * 1000,
    }),
  );
}

/** Files in a Commons category, 500 per request (cached for an hour). */
export async function getCategoryFiles(
  category: string,
  from?: Record<string, string>,
): Promise<{ files: string[]; next?: Record<string, string> }> {
  const json = await query<{
    query?: { categorymembers: { title: string }[] };
    continue?: Record<string, string>;
  }>({
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmnamespace: "6",
    cmtype: "file",
    cmlimit: "500",
    ...from,
  });
  return {
    files: (json.query?.categorymembers ?? []).map((m) =>
      m.title.replace(/^File:/, ""),
    ),
    next: json.continue,
  };
}

export interface FileInfo {
  /** thumbnail of the requested width */
  url: string;
  width: number;
  height: number;
  description?: string;
  artist?: string;
  date?: string;
}

/**
 * Thumbnails and metadata (description, author, date) of Commons files, in
 * batches of 50 (cached for an hour); calls `onInfos` as each batch arrives.
 */
export async function getFileInfos(
  files: string[],
  width: number,
  language: string,
  onInfos: (infos: Record<string, FileInfo>) => void,
): Promise<void> {
  const batches = [];
  for (let i = 0; i < files.length; i += 50)
    batches.push(files.slice(i, i + 50));
  await Promise.all(
    batches.map(async (batch) => {
      const json = await query<{
        query: {
          pages: {
            title: string;
            imageinfo?: {
              thumburl: string;
              thumbwidth: number;
              thumbheight: number;
              extmetadata?: Record<string, { value: string }>;
            }[];
          }[];
        };
      }>({
        titles: batch.map((f) => `File:${f}`).join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: String(width),
        iiextmetadatafilter: "ImageDescription|Artist|DateTimeOriginal",
        iiextmetadatalanguage: language,
      });
      const infos: Record<string, FileInfo> = {};
      for (const page of json.query.pages) {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl) continue;
        const meta = info.extmetadata;
        infos[page.title.replace(/^File:/, "")] = {
          url: info.thumburl,
          width: info.thumbwidth,
          height: info.thumbheight,
          description: text(meta?.ImageDescription?.value),
          artist: text(meta?.Artist?.value),
          date: text(meta?.DateTimeOriginal?.value),
        };
      }
      onInfos(infos);
    }),
  );
}

/**
 * File name from a Commons file page URL (`…/wiki/File:A.jpg`,
 * `…?title=File:A.jpg`), an upload URL (also thumbnails) or `File:A.jpg`.
 */
export function parseCommonsFile(input: string): string | undefined {
  const text = input.trim();
  const title = text.match(/^(?:File|Image):(.+)$/i)?.[1];
  if (title) return title.replace(/_/g, " ");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  const decode = (s: string) => decodeURIComponent(s).replace(/_/g, " ");
  if (url.hostname === "commons.wikimedia.org") {
    const page =
      url.searchParams.get("title") ??
      url.pathname.match(/^\/wiki\/(.+)$/)?.[1];
    const file = page && decode(page).match(/^(?:File|Image):(.+)$/i)?.[1];
    return file || undefined;
  }
  if (url.hostname === "upload.wikimedia.org") {
    // /wikipedia/commons/a/ab/A.jpg or …/thumb/a/ab/A.jpg/320px-A.jpg
    const m = url.pathname.match(
      /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/,
    );
    return m ? decode(m[1]) : undefined;
  }
  return undefined;
}

/** ID of the structured data (MediaInfo) of a Commons file: `M` + page ID. */
export async function getMediaInfoId(
  file: string,
): Promise<string | undefined> {
  const json = await query<{
    query: { pages: { pageid?: number; missing?: boolean }[] };
  }>({ titles: `File:${file}` });
  const page = json.query.pages[0];
  return page?.pageid && !page.missing ? `M${page.pageid}` : undefined;
}

/** Commons file shown enlarged in the media dialog (one for the whole app). */
export const useMediaDialog = createGlobalState(() => ref<string>());
