import { cachedFetch } from "./cache";
import { getImageInfo } from "./commons";
import { api, description, fallbackLanguages, label } from "./wikidata";
import type { Entity } from "./wikidata";

const MAX_AGE = 60 * 60 * 1000;
/** thumbnail size of the preview image (CSS pixels, like Page Previews) */
const THUMB_SIZE = 320;

/** What a hover card shows for an item, like Page Previews on Wikipedia. */
export interface Preview {
  id: string;
  label?: string;
  description?: string;
  /** lead of the Wikipedia article, in the user language or else English */
  extract?: { text: string; lang: string; dir: string };
  image?: { url: string; width: number; height: number };
}

interface Summary {
  extract?: string;
  lang: string;
  dir: string;
  thumbnail?: { source: string; width: number; height: number };
}

/** Wikipedia languages tried for the extract: the user language, else English. */
export const wikipediaLanguages = (language: string) =>
  fallbackLanguages(language).filter((l) => l !== "mul");

const wikiId = (lang: string) => `${lang.replace(/-/g, "_")}wiki`;

async function getSummary(lang: string, title: string): Promise<Summary> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  return JSON.parse(
    await cachedFetch(url, { cacheName: "previews", maxAge: MAX_AGE }),
  );
}

/** The first image (P18) of the item, as a thumbnail from Commons. */
async function getP18(id: string): Promise<Preview["image"]> {
  const json = await api<{
    claims?: Record<string, { mainsnak: { datavalue?: { value: string } } }[]>;
  }>(
    { action: "wbgetclaims", entity: id, property: "P18" },
    { maxAge: MAX_AGE },
  );
  const file = json.claims?.P18?.[0]?.mainsnak.datavalue?.value;
  if (!file) return undefined;
  const info = await getImageInfo(file, THUMB_SIZE, THUMB_SIZE);
  return info && { url: info.url, width: info.width, height: info.height };
}

/**
 * Label and description from Wikidata, the lead of the linked Wikipedia
 * article and its image, else the item's image (P18).
 */
export async function fetchPreview(
  id: string,
  language: string,
): Promise<Preview> {
  const langs = wikipediaLanguages(language);
  const json = await api<{ entities: Record<string, Entity> }>(
    {
      action: "wbgetentities",
      ids: id,
      props: "labels|descriptions|sitelinks",
      languages: fallbackLanguages(language).join("|"),
      sitefilter: langs.map(wikiId).join("|"),
    },
    { maxAge: MAX_AGE },
  );
  const entity = json.entities[id];
  const lang = langs.find((l) => entity?.sitelinks?.[wikiId(l)]);
  const summary = lang
    ? await getSummary(lang, entity.sitelinks![wikiId(lang)].title).catch(
        (e) => (console.warn(e), undefined),
      )
    : undefined;
  const thumbnail = summary?.thumbnail;
  return {
    id,
    label: label(entity, language),
    description: description(entity, language),
    extract: summary?.extract
      ? { text: summary.extract, lang: summary.lang, dir: summary.dir }
      : undefined,
    image: thumbnail
      ? {
          url: thumbnail.source,
          width: thumbnail.width,
          height: thumbnail.height,
        }
      : await getP18(id).catch((e) => (console.warn(e), undefined)),
  };
}

const previews = new Map<string, Promise<Preview>>();

/** {@link fetchPreview}, once per item and language. */
export function getPreview(id: string, language: string): Promise<Preview> {
  const key = `${language}:${id}`;
  let preview = previews.get(key);
  if (!preview) {
    preview = fetchPreview(id, language);
    preview.catch(() => previews.delete(key));
    previews.set(key, preview);
  }
  return preview;
}

/** Items get previews; properties and lexemes keep their description tooltip. */
export const isItem = (id: string) => /^Q\d+$/.test(id);

/** The item linked by an in-app link such as `#Q42` (not `#Q42/Q64`). */
export function previewTarget(el: EventTarget | null): {
  link: HTMLAnchorElement;
  id: string;
} | void {
  const link = (el as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
  const id = link?.getAttribute("href")?.slice(1);
  if (link && id && isItem(id) && !link.closest(".dd-preview"))
    return { link, id };
}
