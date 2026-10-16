import { cachedFetch, sessionCache } from "./cache";

const API = "https://www.wikidata.org/w/api.php";

export interface SearchResult {
  id: string;
  label?: string;
  description?: string;
}

export interface Snak {
  snaktype: "value" | "somevalue" | "novalue";
  property: string;
  datatype?: string;
  datavalue?: { type: string; value: unknown };
}

export interface Claim {
  id: string;
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: Snak;
  qualifiers?: Record<string, Snak[]>;
  references?: { snaks: Record<string, Snak[]> }[];
}

export interface Entity {
  id: string;
  labels: Record<string, { value: string }>;
  descriptions: Record<string, { value: string }>;
  aliases: Record<string, { value: string }[]>;
  claims: Record<string, Claim[]>;
  sitelinks?: Record<string, { site: string; title: string }>;
}

async function api<T>(
  params: Record<string, string>,
  cache?: { maxAge: number; bypass?: boolean },
): Promise<T> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();
  if (cache)
    return JSON.parse(
      await cachedFetch(url.toString(), { cacheName: "api", ...cache }),
    );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function searchEntities(
  search: string,
  language: string,
  type: "item" | "property" = "item",
): Promise<SearchResult[]> {
  const json = await api<{ search: SearchResult[] }>({
    action: "wbsearchentities",
    search,
    language,
    uselang: language,
    type,
    limit: "10",
  });
  return json.search;
}

/** Fetch full entities (cached for an hour unless `bypass`). */
export async function getEntities(
  ids: string[],
  props = "labels|descriptions|aliases|claims|sitelinks",
  languages?: string[],
  bypass = false,
): Promise<Record<string, Entity>> {
  const batches = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  const results = await Promise.all(
    batches.map((batch) =>
      api<{ entities: Record<string, Entity> }>(
        {
          action: "wbgetentities",
          ids: batch.join("|"),
          props,
          ...(languages && { languages: languages.join("|") }),
        },
        { maxAge: 60 * 60 * 1000, bypass },
      ),
    ),
  );
  return Object.assign({}, ...results.map((r) => r.entities));
}

export function label(
  entity: Pick<Entity, "labels"> | undefined,
  language: string,
): string | undefined {
  return entity?.labels?.[language]?.value ?? entity?.labels?.en?.value;
}

export function description(
  entity: Pick<Entity, "descriptions"> | undefined,
  language: string,
): string | undefined {
  return (
    entity?.descriptions?.[language]?.value ??
    entity?.descriptions?.en?.value
  );
}

/**
 * Fetch labels and descriptions in parallel batches, calling `onLabels` as
 * each batch arrives so the UI can fill in progressively. Both are cached in
 * sessionStorage.
 */
export async function getLabels(
  ids: string[],
  language: string,
  onLabels: (
    labels: Record<string, string>,
    descriptions: Record<string, string>,
  ) => void,
): Promise<void> {
  const labelKey = (id: string) => `label:${language}:${id}`;
  const descriptionKey = (id: string) => `description:${language}:${id}`;
  const cached: Record<string, string> = {};
  const cachedDescriptions: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const l = sessionCache.get(labelKey(id));
    const d = sessionCache.get(descriptionKey(id));
    if (l === null || d === null) missing.push(id);
    else {
      cached[id] = l;
      if (d) cachedDescriptions[id] = d;
    }
  }
  if (missing.length < ids.length) onLabels(cached, cachedDescriptions);
  const languages = [...new Set([language, "en"])].join("|");
  const batches = [];
  for (let i = 0; i < missing.length; i += 50)
    batches.push(missing.slice(i, i + 50));
  await Promise.all(
    batches.map(async (batch) => {
      const json = await api<{ entities: Record<string, Entity> }>({
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "labels|descriptions",
        languages,
      });
      const labels: Record<string, string> = {};
      const descriptions: Record<string, string> = {};
      for (const [id, e] of Object.entries(json.entities)) {
        labels[id] = label(e, language) ?? id;
        const d = description(e, language);
        if (d) descriptions[id] = d;
        sessionCache.set(labelKey(id), labels[id]);
        sessionCache.set(descriptionKey(id), d ?? "");
      }
      onLabels(labels, descriptions);
    }),
  );
}
