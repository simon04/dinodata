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

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();
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

export async function getEntities(
  ids: string[],
  props = "labels|descriptions|aliases|claims|sitelinks",
  languages?: string[],
): Promise<Record<string, Entity>> {
  const batches = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  const results = await Promise.all(
    batches.map((batch) =>
      api<{ entities: Record<string, Entity> }>({
        action: "wbgetentities",
        ids: batch.join("|"),
        props,
        ...(languages && { languages: languages.join("|") }),
      }),
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

const labelCache = new Map<string, string>();

/**
 * Fetch labels in parallel batches, calling `onLabels` as each batch arrives
 * so the UI can fill in progressively. Labels are cached in memory.
 */
export async function getLabels(
  ids: string[],
  language: string,
  onLabels: (labels: Record<string, string>) => void,
): Promise<void> {
  const key = (id: string) => `${language}:${id}`;
  const cached = ids.filter((id) => labelCache.has(key(id)));
  if (cached.length)
    onLabels(
      Object.fromEntries(cached.map((id) => [id, labelCache.get(key(id))!])),
    );
  const missing = ids.filter((id) => !labelCache.has(key(id)));
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
      for (const [id, l] of Object.entries(labels)) labelCache.set(key(id), l);
      onLabels(labels);
    }),
  );
}
