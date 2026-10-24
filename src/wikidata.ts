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
  /** revision ID, for edit conflict detection */
  lastrevid?: number;
  labels: Record<string, { value: string }>;
  descriptions: Record<string, { value: string }>;
  aliases: Record<string, { value: string }[]>;
  claims: Record<string, Claim[]>;
  sitelinks?: Record<string, { site: string; title: string }>;
}

/** GET from the Action API of Wikidata, or another Wikibase via `endpoint`. */
export async function api<T>(
  params: Record<string, string>,
  cache?: { maxAge: number; bypass?: boolean },
  endpoint = API,
): Promise<T> {
  const url = new URL(endpoint);
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
  props = "info|labels|descriptions|aliases|claims|sitelinks",
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

/** The user language, then multilingual (`mul`), then English. */
export function fallbackLanguages(language: string): string[] {
  return [...new Set([language, "mul", "en"])];
}

/** The term in the first available language of {@link fallbackLanguages}. */
export function term<T>(
  terms: Record<string, T> | undefined,
  language: string,
): T | undefined {
  for (const l of fallbackLanguages(language))
    if (terms?.[l] !== undefined) return terms[l];
}

export function label(
  entity: Pick<Entity, "labels"> | undefined,
  language: string,
): string | undefined {
  return term(entity?.labels, language)?.value;
}

export function description(
  entity: Pick<Entity, "descriptions"> | undefined,
  language: string,
): string | undefined {
  return term(entity?.descriptions, language)?.value;
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
  const languages = fallbackLanguages(language).join("|");
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

export interface Backlink {
  title: string;
  /** item, property or lexeme ID, for entity pages */
  id?: string;
  label?: string;
  description?: string;
}

/** namespace → title prefix of entity pages */
const ENTITY_NAMESPACES: Record<number, string> = {
  0: "",
  120: "Property:",
  146: "Lexeme:",
};
const TITLE_PREFIXES: Record<string, string> = { P: "Property:", L: "Lexeme:" };

/**
 * Pages linking to the entity (via statements, or wikitext on other pages),
 * 500 per request, with labels and descriptions of linking entities
 * (cached for an hour).
 */
export async function getBacklinks(
  id: string,
  language: string,
  from?: Record<string, string>,
): Promise<{ pages: Backlink[]; next?: Record<string, string> }> {
  const json = await api<{
    query?: {
      pages: {
        ns: number;
        title: string;
        entityterms?: { label?: string[]; description?: string[] };
      }[];
    };
    continue?: Record<string, string>;
  }>(
    {
      action: "query",
      generator: "backlinks",
      gbltitle: `${TITLE_PREFIXES[id[0]] ?? ""}${id}`,
      gbllimit: "max",
      prop: "entityterms",
      wbetterms: "label|description",
      wbetlanguage: language,
      ...from,
    },
    { maxAge: 60 * 60 * 1000 },
  );
  const pages: Backlink[] = (json.query?.pages ?? []).map(
    ({ ns, title, entityterms }) => {
      const prefix = ENTITY_NAMESPACES[ns];
      return {
        title,
        ...(prefix !== undefined && { id: title.slice(prefix.length) }),
        label: entityterms?.label?.[0],
        description: entityterms?.description?.[0],
      };
    },
  );
  // entityterms has no language fallback, complete missing terms of items and properties
  const incomplete = pages.filter(
    (p) => p.id && /^[PQ]/.test(p.id) && !(p.label && p.description),
  );
  if (incomplete.length) {
    const entities = await getEntities(
      incomplete.map((p) => p.id!),
      "labels|descriptions",
      fallbackLanguages(language),
    );
    for (const p of incomplete) {
      const l = label(entities[p.id!], language);
      const d = description(entities[p.id!], language);
      if (l) p.label ??= l;
      if (d) p.description ??= d;
    }
  }
  return { pages, next: json.continue };
}

/** Error reported by the Action API, e.g. `editconflict` or `permissiondenied`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    info: string,
  ) {
    super(info);
    this.name = "ApiError";
  }
}

/**
 * Authenticated POST to the Action API with an OAuth 2.0 access token.
 * `crossorigin` (instead of `origin=*`) keeps the request authenticated;
 * `assertuser` fails instead of editing anonymously. No `maxlag`: it is meant
 * for bots, and on Wikidata includes the query service lag, which can block
 * interactive edits for long.
 */
export async function apiPost<T>(
  params: Record<string, string>,
  auth: { accessToken: string; username: string },
): Promise<T> {
  const url = new URL(API);
  url.search = new URLSearchParams({ crossorigin: "" }).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    body: new URLSearchParams({
      format: "json",
      formatversion: "2",
      errorformat: "plaintext",
      assertuser: auth.username,
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  const error = json.errors?.[0] as { code: string; text: string } | undefined;
  if (error) throw new ApiError(error.code, error.text);
  return json as T;
}

/** CSRF token for edits by the authenticated user. */
export async function getCsrfToken(auth: {
  accessToken: string;
  username: string;
}): Promise<string> {
  const json = await apiPost<{ query: { tokens: { csrftoken: string } } }>(
    { action: "query", meta: "tokens", type: "csrf" },
    auth,
  );
  return json.query.tokens.csrftoken;
}

/**
 * Edit an entity in one revision (`wbeditentity`). `baserevid` makes
 * concurrent edits fail with `editconflict` instead of being overwritten.
 */
export async function editEntity(
  id: string,
  data: object,
  {
    baserevid,
    summary,
    auth,
  }: {
    baserevid: number;
    summary: string;
    auth: { accessToken: string; username: string };
  },
): Promise<{ lastrevid: number }> {
  const token = await getCsrfToken(auth);
  const json = await apiPost<{ entity: { lastrevid: number } }>(
    {
      action: "wbeditentity",
      id,
      data: JSON.stringify(data),
      baserevid: String(baserevid),
      summary,
      token,
    },
    auth,
  );
  return { lastrevid: json.entity.lastrevid };
}
