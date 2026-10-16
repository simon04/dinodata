import { createGlobalState } from "@vueuse/core";
import { ref } from "vue";

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

/** Commons file shown enlarged in the media dialog (one for the whole app). */
export const useMediaDialog = createGlobalState(() => ref<string>());
