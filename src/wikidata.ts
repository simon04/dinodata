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
): Promise<Record<string, Entity>> {
  const result: Record<string, Entity> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const json = await api<{ entities: Record<string, Entity> }>({
      action: "wbgetentities",
      ids: ids.slice(i, i + 50).join("|"),
      props,
    });
    Object.assign(result, json.entities);
  }
  return result;
}

export function label(
  entity: Pick<Entity, "labels"> | undefined,
  language: string,
): string | undefined {
  return entity?.labels?.[language]?.value ?? entity?.labels?.en?.value;
}
