import { ref, watch, type Ref } from "vue";
import { cachedFetch } from "./cache";
import { fallbackLanguages, term } from "./wikidata";

export interface Property {
  id: string;
  datatype: string;
  // language → texts
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  aliases: Record<string, string[]>;
  /** formatter URL (P1630) with $1 placeholder */
  formatterUrl?: string;
}

const SPARQL = "https://query.wikidata.org/sparql";
const API = "https://www.wikidata.org/w/api.php";
const MAX_AGE = 24 * 60 * 60 * 1000;
/** parallel chains of API requests, more get rate limited */
const CONCURRENCY = 3;

// wikiba.se ontology type → Wikibase API datatype
const DATATYPES: Record<string, string> = {
  CommonsMedia: "commonsMedia",
  EntitySchema: "entity-schema",
  ExternalId: "external-id",
  GeoShape: "geo-shape",
  GlobeCoordinate: "globe-coordinate",
  Math: "math",
  Monolingualtext: "monolingualtext",
  MusicalNotation: "musical-notation",
  Quantity: "quantity",
  String: "string",
  TabularData: "tabular-data",
  Time: "time",
  Url: "url",
  WikibaseForm: "wikibase-form",
  WikibaseItem: "wikibase-item",
  WikibaseLexeme: "wikibase-lexeme",
  WikibaseProperty: "wikibase-property",
  WikibaseSense: "wikibase-sense",
};

/** Datatypes and formatter URLs, independent of the language. */
const TYPES_QUERY = `SELECT ?p ?type ?f WHERE {
  ?p wikibase:propertyType ?type .
  OPTIONAL { ?p wdt:P1630 ?f }
}`;

/** Unescape a SPARQL TSV literal. */
export const unescape = (s: string) =>
  s.replace(/\\(.)/g, (_, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c,
  );

type Types = Map<string, { datatype: string; formatterUrl?: string }>;

/** Parse the SPARQL TSV result (compact compared to JSON). */
function parseTypes(tsv: string): Types {
  const types: Types = new Map();
  for (const line of tsv.split("\n").slice(1)) {
    const [p, type, f] = line.split("\t");
    if (!type) continue;
    const id = p.slice(p.lastIndexOf("/") + 1, -1);
    const name = type.slice(type.lastIndexOf("#") + 1, -1);
    const entry = types.get(id) ?? { datatype: DATATYPES[name] ?? name };
    if (f && !entry.formatterUrl) entry.formatterUrl = unescape(f.slice(1, -1));
    types.set(id, entry);
  }
  return types;
}

async function fetchTypes(): Promise<Types> {
  const url = `${SPARQL}?query=${encodeURIComponent(TYPES_QUERY)}`;
  const body = await cachedFetch(url, {
    cacheName: "properties-v4",
    maxAge: MAX_AGE,
    staleWhileRevalidate: true,
    init: { headers: { Accept: "text/tab-separated-values" } },
  });
  return parseTypes(body);
}

const ORDER_PAGE = "MediaWiki:Wikibase-SortedProperties";
let order: Promise<Map<string, number>> | undefined;

/**
 * The property order of statements on Wikidata entity pages, from
 * [[MediaWiki:Wikibase-SortedProperties]]: property ID → position.
 */
export function getPropertyOrder(): Promise<Map<string, number>> {
  order ??= (async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      prop: "revisions",
      titles: ORDER_PAGE,
      rvprop: "content",
      rvslots: "main",
    });
    const json = JSON.parse(
      await cachedFetch(`${API}?${params}`, {
        cacheName: "properties-v4",
        maxAge: MAX_AGE,
        staleWhileRevalidate: true,
      }),
    ) as {
      query: {
        pages: { revisions?: { slots: { main: { content: string } } }[] }[];
      };
    };
    return parsePropertyOrder(
      json.query.pages[0]?.revisions?.[0]?.slots.main.content ?? "",
    );
  })().catch((e) => {
    order = undefined;
    throw e;
  });
  return order;
}

/** Parse the list items `* P31 (instance of)`, keeping the first position. */
export function parsePropertyOrder(wikitext: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const [, id] of wikitext.matchAll(/^[*#]\s*(P\d+)/gm))
    if (!result.has(id)) result.set(id, result.size);
  return result;
}

interface TermsPage {
  title: string;
  entityterms?: { label?: string[]; description?: string[]; alias?: string[] };
}

/**
 * Labels, descriptions and aliases of all properties (with language
 * fallback), 500 per request. Titles sort as strings, so the property pages
 * are split by their first digit into chains, a few of them run in parallel.
 */
async function fetchTerms(
  language: string,
  onPages: (pages: TermsPage[]) => void,
): Promise<void> {
  const chain = async (prefix: string) => {
    let next: Record<string, string> | undefined = {};
    while (next) {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        origin: "*",
        generator: "allpages",
        gapnamespace: "120",
        gapprefix: prefix,
        gaplimit: "max",
        prop: "entityterms",
        wbetterms: "label|description|alias",
        wbetlanguage: language,
        ...next,
      });
      const json = JSON.parse(
        await cachedFetch(`${API}?${params}`, {
          cacheName: "properties-v4",
          maxAge: MAX_AGE,
          staleWhileRevalidate: true,
        }),
      ) as {
        query?: { pages: TermsPage[] };
        continue?: Record<string, string>;
      };
      onPages(json.query?.pages ?? []);
      next = json.continue;
    }
  };
  const prefixes = "123456789".split("").map((d) => `P${d}`);
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let prefix; (prefix = prefixes.shift());) await chain(prefix);
    }),
  );
}

const properties = ref<Property[]>([]);
const byId = ref<Record<string, Property>>({});
// lowercased labels and aliases (user language and English) for fast search
let index: { p: Property; labels: string[]; aliases: string[] }[] = [];
const loading = ref(false);
const error = ref<string>();

/** all properties with terms loaded so far, kept across language changes */
const all = new Map<string, Property>();
let types: Types | undefined;

function getProperty(id: string): Property {
  let p = all.get(id);
  if (!p) {
    p = { id, datatype: "", labels: {}, descriptions: {}, aliases: {} };
    all.set(id, p);
  }
  return p;
}

/** Expose the properties with a known datatype, and index them for search. */
function publish(language: string) {
  if (!types) return;
  const result = [...all.values()]
    .filter((p) => p.datatype)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  properties.value = result;
  byId.value = Object.fromEntries(result.map((p) => [p.id, p]));
  const languages = fallbackLanguages(language);
  index = result.map((p) => ({
    p,
    labels: languages.flatMap((l) => p.labels[l]?.toLowerCase() ?? []),
    aliases: languages.flatMap(
      (l) => p.aliases[l]?.map((a) => a.toLowerCase()) ?? [],
    ),
  }));
}

/**
 * Preload all Wikidata properties in the user language and English, made
 * available as each batch arrives.
 */
export function loadProperties(language: Ref<string>) {
  watch(
    language,
    async (lang) => {
      loading.value = true;
      error.value = undefined;
      try {
        const terms = (l: string) =>
          fetchTerms(l, (pages) => {
            for (const page of pages) {
              const id = page.title.slice(page.title.indexOf(":") + 1);
              const p = getProperty(id);
              const { label, description, alias } = page.entityterms ?? {};
              if (label?.[0]) p.labels[l] = label[0];
              if (description?.[0]) p.descriptions[l] = description[0];
              if (alias?.length) p.aliases[l] = alias;
            }
            publish(language.value);
          });
        await Promise.all([
          fetchTypes().then((t) => {
            types = t;
            for (const [id, { datatype, formatterUrl }] of t) {
              const p = getProperty(id);
              p.datatype = datatype;
              if (formatterUrl) p.formatterUrl = formatterUrl;
            }
            publish(language.value);
          }),
          // the user language first, then multilingual and English for search and fallback
          terms(lang).then(() =>
            Promise.all(fallbackLanguages(lang).slice(1).map(terms)),
          ),
        ]);
      } catch (e) {
        error.value = String(e);
      } finally {
        loading.value = false;
      }
    },
    { immediate: true },
  );
}

export function useProperties() {
  return { properties, byId, loading, error };
}

export function propertyLabel(
  p: Property | undefined,
  language: string,
): string | undefined {
  return term(p?.labels, language);
}

export function propertyDescription(
  p: Property | undefined,
  language: string,
): string | undefined {
  return term(p?.descriptions, language);
}

/**
 * Search properties locally by ID (P31, 31), URL (…/Property:P31,
 * …/entity/P31, …/prop/direct/P31), label or alias in English or the user
 * language (as loaded by {@link loadProperties}).
 */
export function searchProperties(input: string, limit = 20): Property[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const idMatch = q.match(/^p?(\d+)$/) ?? q.match(/[/:#=]p(\d+)\/?$/);
  const exact = idMatch ? byId.value[`P${idMatch[1]}`] : undefined;
  if (exact && q.includes("/")) return [exact];

  const scored: [number, Property][] = [];
  for (const { p, labels, aliases } of index) {
    let score = p.id === exact?.id ? 1000 : 0;
    for (const label of labels) {
      if (label === q) score = Math.max(score, 100);
      else if (label.startsWith(q)) score = Math.max(score, 80);
      else if (label.includes(` ${q}`)) score = Math.max(score, 60);
      else if (label.includes(q)) score = Math.max(score, 40);
    }
    for (const a of aliases) {
      if (a === q) score = Math.max(score, 90);
      else if (a.startsWith(q)) score = Math.max(score, 70);
      else if (a.includes(q)) score = Math.max(score, 30);
    }
    if (score) scored.push([score, p]);
  }
  // stable sort keeps lower property IDs (older, usually more used) first
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, p]) => p);
}
