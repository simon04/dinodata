import { shallowRef } from "vue";
import { api, type Claim, type Entity } from "../wikidata";
import type { OsmType } from "./osm-ref";
import type { Tags } from "./osm";

/**
 * Documentation of keys and tags from the Wikibase of the OSM wiki: one item
 * per key (`Key:surface`) and tag (`Tag:highway=residential`), found via
 * their sitelinks. https://wiki.openstreetmap.org/wiki/OpenStreetMap:Wikibase
 */

export const WIKI = "https://wiki.openstreetmap.org";
const API = `${WIKI}/w/api.php`;
const MAX_AGE = 24 * 60 * 60 * 1000;

/** status items whose keys or tags should not be used anymore */
const DISCOURAGED = new Set(["Q5061", "Q7550", "Q5060", "Q16", "Q19"]);
const APPLICABLE = "Q8000";
const NOT_APPLICABLE = "Q8001";

export interface TagDoc {
  /** item ID on the OSM wiki, e.g. Q5043 */
  item: string;
  /** wiki page, e.g. Tag:highway=residential */
  page: string;
  description?: string;
  /** status item, e.g. Q15 (approved) */
  status?: string;
  /** deprecated, discardable, obsolete, rejected or abandoned */
  discouraged: boolean;
  /** image file name on the OSM wiki */
  image?: string;
  /** Wikidata concept */
  wikidata?: string;
  /** value validation regex (P13) */
  regex?: string;
  /** formatter URL (P8) with $1 */
  formatterUrl?: string;
  /** element types it applies to; missing = unknown */
  appliesTo: Partial<Record<OsmType | "area", boolean>>;
  /** items: replaced by, implies, combination, incompatible, requires */
  replacedBy: string[];
  implies: string[];
  combination: string[];
  incompatible: string[];
  requires: string[];
  /** documentation page in the user language, if any */
  localPage?: string;
}

const best = (claims: Claim[] = []) => {
  const preferred = claims.filter((c) => c.rank === "preferred");
  return preferred.length
    ? preferred
    : claims.filter((c) => c.rank === "normal");
};
const itemIds = (claims?: Claim[]) =>
  best(claims).flatMap((c) => {
    const id = (c.mainsnak.datavalue?.value as { id?: string })?.id;
    return id ? [id] : [];
  });
const string = (claims?: Claim[]) => {
  const value = best(claims)[0]?.mainsnak.datavalue?.value;
  return typeof value === "string" ? value : undefined;
};

function text(
  values: Record<string, { value: string }> | undefined,
  language: string,
): string | undefined {
  return (
    values?.[language]?.value ??
    values?.mul?.value ??
    values?.en?.value ??
    Object.values(values ?? {})[0]?.value
  );
}

/** Parse a key or tag item. */
export function toTagDoc(entity: Entity, language: string): TagDoc {
  const c = entity.claims;
  const applies = (p: string) => {
    const [id] = itemIds(c[p]);
    return id === APPLICABLE ? true : id === NOT_APPLICABLE ? false : undefined;
  };
  const appliesTo: TagDoc["appliesTo"] = {};
  for (const [type, p] of [
    ["node", "P33"],
    ["way", "P34"],
    ["area", "P35"],
    ["relation", "P36"],
  ] as const) {
    const value = applies(p);
    if (value !== undefined) appliesTo[type] = value;
  }
  // images may be limited to a language (P26): prefer unqualified ones
  const images = best(c.P28);
  const image = (images.find((i) => !i.qualifiers) ?? images[0])?.mainsnak
    .datavalue?.value;
  const pages = (c.P31 ?? []).map(
    (claim) =>
      claim.mainsnak.datavalue?.value as { text: string; language: string },
  );
  const [status] = itemIds(c.P6);
  return {
    item: entity.id,
    page:
      entity.sitelinks?.wiki?.title ??
      pages.find((p) => p.language === "en")?.text ??
      "",
    description: text(entity.descriptions, language),
    status,
    discouraged: !!status && DISCOURAGED.has(status),
    image: typeof image === "string" ? image : undefined,
    wikidata: string(c.P12),
    regex: string(c.P13),
    formatterUrl: string(c.P8),
    appliesTo,
    replacedBy: itemIds(c.P17),
    implies: itemIds(c.P45),
    combination: itemIds(c.P46),
    incompatible: itemIds(c.P44),
    requires: itemIds(c.P22),
    localPage:
      language === "en"
        ? undefined
        : pages.find((p) => p.language === language)?.text,
  };
}

/** Wiki page title of a key or tag. */
export const keyPage = (key: string) => `Key:${key}`;
export const tagPage = (key: string, value: string) => `Tag:${key}=${value}`;

/** URL of a wiki page. */
export const wikiUrl = (page: string) =>
  `${WIKI}/wiki/${encodeURIComponent(page.replace(/ /g, "_")).replace(/%3A/g, ":")}`;

/** Thumbnail of an image on the OSM wiki. */
export const wikiImageUrl = (file: string, width = 320) =>
  `${WIKI}/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

/**
 * Documentation of the keys and tags, keyed by `key` and `key=value`.
 * Values with `;` (several values) and free text values (names) are only
 * looked up as keys.
 */
export async function getTagDocs(
  tags: Tags,
  language: string,
): Promise<Record<string, TagDoc>> {
  const titles = new Set<string>();
  for (const [key, value] of Object.entries(tags)) {
    titles.add(keyPage(key));
    if (value.length < 64 && !value.includes(";") && !/\s/.test(value))
      titles.add(tagPage(key, value));
  }
  const list = [...titles];
  const batches = [];
  for (let i = 0; i < list.length; i += 50) batches.push(list.slice(i, i + 50));
  const languages = [...new Set([language, "mul", "en"])].join("|");
  const results = await Promise.all(
    batches.map((batch) =>
      api<{ entities: Record<string, Entity | { missing: string }> }>(
        {
          action: "wbgetentities",
          sites: "wiki",
          titles: batch.join("|"),
          props: "labels|descriptions|claims|sitelinks",
          languages,
        },
        { maxAge: MAX_AGE },
        API,
      ),
    ),
  );
  const docs: Record<string, TagDoc> = {};
  for (const { entities } of results)
    for (const entity of Object.values(entities)) {
      if ("missing" in entity) continue;
      const key = string(entity.claims.P16);
      const tag = string(entity.claims.P19);
      const name = tag ?? key;
      if (name) docs[name] = toTagDoc(entity, language);
    }
  return docs;
}

/** Labels of OSM wiki items, e.g. statuses or `highway=footway` for tags. */
export async function getItemLabels(
  ids: string[],
  language: string,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const batches = [];
  for (let i = 0; i < unique.length; i += 50)
    batches.push(unique.slice(i, i + 50));
  const languages = [...new Set([language, "mul", "en"])].join("|");
  const results = await Promise.all(
    batches.map((batch) =>
      api<{ entities: Record<string, Entity> }>(
        {
          action: "wbgetentities",
          ids: batch.join("|"),
          props: "labels",
          languages,
        },
        { maxAge: MAX_AGE },
        API,
      ),
    ),
  );
  const labels: Record<string, string> = {};
  for (const { entities } of results)
    for (const [id, e] of Object.entries(entities)) {
      const label = text(e.labels, language);
      if (label) labels[id] = label.replace(/^\(DEPRECATED\)\s*/, "");
    }
  return labels;
}

/** All referenced items of the docs, for `getItemLabels`. */
export function referencedItems(docs: TagDoc[]): string[] {
  return docs.flatMap((d) => [
    ...(d.status ? [d.status] : []),
    ...d.replacedBy,
    ...d.implies,
    ...d.combination,
    ...d.incompatible,
    ...d.requires,
  ]);
}

/**
 * Documentation of the tags of an element, loaded as tags are added; keys
 * and tags are requested only once.
 */
export function useTagDocs(language: () => string) {
  const docs = shallowRef<Record<string, TagDoc>>({});
  const itemLabels = shallowRef<Record<string, string>>({});
  let requested = new Set<string>();
  let lang = language();

  async function load(tags: Tags) {
    if (lang !== language()) {
      lang = language();
      requested = new Set();
      docs.value = {};
      itemLabels.value = {};
    }
    const missing: Tags = {};
    for (const [key, value] of Object.entries(tags)) {
      const name = `${key}=${value}`;
      if (requested.has(name)) continue;
      requested.add(name);
      missing[key] = value;
    }
    if (!Object.keys(missing).length) return;
    const l = lang;
    const loaded = await getTagDocs(missing, l);
    if (l !== lang) return;
    docs.value = { ...docs.value, ...loaded };
    const ids = referencedItems(Object.values(loaded)).filter(
      (id) => !itemLabels.value[id],
    );
    if (!ids.length) return;
    const labels = await getItemLabels(ids, l);
    if (l === lang) itemLabels.value = { ...itemLabels.value, ...labels };
  }

  return { docs, itemLabels, load };
}
