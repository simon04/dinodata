import { ref, watch, type Ref } from "vue";

export interface Property {
  id: string;
  datatype: string;
  // language → texts
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  aliases: Record<string, string[]>;
}

const SPARQL = "https://query.wikidata.org/sparql";
const CACHE = "dinodata-properties-v2";
const MAX_AGE = 24 * 60 * 60 * 1000;

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

function query(languages: string[]): string {
  const values = languages.map((l) => JSON.stringify(l)).join(", ");
  return `SELECT ?p ?type ?k ?t WHERE {
  ?p wikibase:propertyType ?type .
  OPTIONAL {
    { ?p rdfs:label ?t BIND("l" AS ?k) }
    UNION { ?p skos:altLabel ?t BIND("a" AS ?k) }
    UNION { ?p schema:description ?t BIND("d" AS ?k) }
    FILTER(LANG(?t) IN (${values}))
  }
}`;
}

const unescape = (s: string) =>
  s.replace(/\\(.)/g, (_, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c,
  );

/** Parse the SPARQL TSV result (compact compared to JSON). */
function parse(tsv: string): Property[] {
  const map = new Map<string, Property>();
  for (const line of tsv.split("\n").slice(1)) {
    const [p, type, k, t] = line.split("\t");
    if (!type) continue;
    const id = p.slice(p.lastIndexOf("/") + 1, -1);
    let property = map.get(id);
    if (!property) {
      const name = type.slice(type.lastIndexOf("#") + 1, -1);
      property = {
        id,
        datatype: DATATYPES[name] ?? name,
        labels: {},
        descriptions: {},
        aliases: {},
      };
      map.set(id, property);
    }
    const m = t?.match(/^"(.*)"@([\w-]+)$/);
    if (!m) continue;
    const text = unescape(m[1]);
    const lang = m[2];
    if (k === '"l"') property.labels[lang] = text;
    else if (k === '"d"') property.descriptions[lang] = text;
    else if (k === '"a"') (property.aliases[lang] ??= []).push(text);
  }
  return [...map.values()].sort(
    (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );
}

async function fetchProperties(languages: string[]): Promise<Property[]> {
  const url = `${SPARQL}?query=${encodeURIComponent(query(languages))}`;
  const cache = "caches" in window ? await caches.open(CACHE) : undefined;
  const cached = await cache?.match(url);
  const fresh = async () => {
    const res = await fetch(url, {
      headers: { Accept: "text/tab-separated-values" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.text();
    await cache?.put(
      url,
      new Response(body, { headers: { "x-fetched": String(Date.now()) } }),
    );
    return parse(body);
  };
  if (cached) {
    const age = Date.now() - Number(cached.headers.get("x-fetched"));
    if (age > MAX_AGE) fresh().catch(console.warn); // refresh in background
    return parse(await cached.text());
  }
  return fresh();
}

const properties = ref<Property[]>([]);
const byId = ref<Record<string, Property>>({});
// lowercased labels and aliases (user language and English) for fast search
let index: { p: Property; labels: string[]; aliases: string[] }[] = [];
const loading = ref(false);
const error = ref<string>();

/** Preload all Wikidata properties in English and the user language. */
export function loadProperties(language: Ref<string>) {
  watch(
    language,
    async (lang) => {
      loading.value = true;
      error.value = undefined;
      try {
        const result = await fetchProperties([...new Set(["en", lang])]);
        properties.value = result;
        byId.value = Object.fromEntries(result.map((p) => [p.id, p]));
        const languages = [...new Set([lang, "en"])];
        index = result.map((p) => ({
          p,
          labels: languages.flatMap((l) => p.labels[l]?.toLowerCase() ?? []),
          aliases: languages.flatMap(
            (l) => p.aliases[l]?.map((a) => a.toLowerCase()) ?? [],
          ),
        }));
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
  return p?.labels[language] ?? p?.labels.en;
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
