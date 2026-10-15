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

/**
 * Fetch labels in parallel batches, calling `onLabels` as each batch arrives
 * so the UI can fill in progressively. Labels are cached in sessionStorage.
 */
export async function getLabels(
  ids: string[],
  language: string,
  onLabels: (labels: Record<string, string>) => void,
): Promise<void> {
  const key = (id: string) => `label:${language}:${id}`;
  const cached: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const l = sessionCache.get(key(id));
    if (l === null) missing.push(id);
    else cached[id] = l;
  }
  if (missing.length < ids.length) onLabels(cached);
  const languages = [...new Set([language, "en"])].join("|");
  const batches = [];
  for (let i = 0; i < missing.length; i += 50)
    batches.push(missing.slice(i, i + 50));
  await Promise.all(
    batches.map(async (batch) => {
      const json = await api<{ entities: Record<string, Entity> }>({
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "labels",
        languages,
      });
      const labels = Object.fromEntries(
        Object.entries(json.entities).map(([id, e]) => [
          id,
          label(e, language) ?? id,
        ]),
      );
      for (const [id, l] of Object.entries(labels))
        sessionCache.set(key(id), l);
      onLabels(labels);
    }),
  );
}
