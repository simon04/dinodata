import { ref, shallowRef } from "vue";
import { cachedFetch } from "./cache";
import { unescape } from "./properties";
import { fallbackLanguages, term } from "./wikidata";

/** A unit of measurement, as used in the allowed units of properties. */
export interface Unit {
  id: string;
  // language → texts
  labels: Record<string, string>;
  aliases: Record<string, string[]>;
  /** unit symbols (P5061) */
  symbols: Record<string, string[]>;
}

export interface UnitData {
  units: Map<string, Unit>;
  /**
   * Property ID → its allowed units (constraint Q21514353); empty if the
   * property allows no unit. Properties without the constraint are missing.
   */
  allowed: Map<string, string[]>;
}

const SPARQL = "https://query.wikidata.org/sparql";
const MAX_AGE = 24 * 60 * 60 * 1000;
const ENTITY = "http://www.wikidata.org/entity/";

/**
 * The allowed units of all properties, and the symbols, labels and aliases of
 * these units in the given languages — in one query, as the query service
 * rate-limits.
 */
const unitsQuery = (languages: string[]) => {
  const filter = `FILTER(LANG(?t) IN (${languages.map((l) => `"${l}"`).join(", ")}))`;
  // the units first, else the query service matches all labels and times out
  return `SELECT ?p ?u ?k ?t
WITH { SELECT DISTINCT ?u WHERE { ?c ps:P2302 wd:Q21514353 ; pq:P2305 ?u } } AS %units
WHERE {
  { ?p p:P2302 ?c . ?c ps:P2302 wd:Q21514353 . OPTIONAL { ?c pq:P2305 ?u } }
  UNION { INCLUDE %units ?u wdt:P5061 ?t BIND("s" AS ?k) ${filter} }
  UNION { INCLUDE %units ?u rdfs:label ?t BIND("l" AS ?k) ${filter} }
  UNION { INCLUDE %units ?u skos:altLabel ?t BIND("a" AS ?k) ${filter} }
}`;
};

const id = (iri: string) => iri.slice(iri.lastIndexOf("/") + 1, -1);

/** Parse the SPARQL TSV result (compact compared to JSON). */
export function parseUnits(tsv: string): UnitData {
  const units = new Map<string, Unit>();
  const allowed = new Map<string, string[]>();
  for (const line of tsv.split("\n").slice(1)) {
    const [p, u, k, t] = line.split("\t");
    if (p) {
      const list = allowed.get(id(p)) ?? [];
      if (u?.startsWith(`<${ENTITY}`)) list.push(id(u));
      allowed.set(id(p), list);
      continue;
    }
    const m = t?.match(/^"(.*)"@([\w-]+)$/s);
    if (!u || !m) continue;
    const text = unescape(m[1]);
    const lang = m[2];
    let unit = units.get(id(u));
    if (!unit) {
      unit = { id: id(u), labels: {}, aliases: {}, symbols: {} };
      units.set(unit.id, unit);
    }
    if (k === '"l"') unit.labels[lang] = text;
    else if (k === '"s"') (unit.symbols[lang] ??= []).push(text);
    else if (k === '"a"') (unit.aliases[lang] ??= []).push(text);
  }
  return { units, allowed };
}

const data = shallowRef<UnitData>();
const loadingUnits = ref(false);
let loading: { language: string; promise: Promise<void> } | undefined;

/**
 * Load the units once, when the first quantity is edited (cached for a day),
 * and again when the language changes.
 */
export function loadUnits(language: string): Promise<void> {
  if (loading?.language === language) return loading.promise;
  const query = unitsQuery(fallbackLanguages(language));
  loadingUnits.value = true;
  const promise = cachedFetch(`${SPARQL}?query=${encodeURIComponent(query)}`, {
    cacheName: "units-v2",
    maxAge: MAX_AGE,
    staleWhileRevalidate: true,
    init: { headers: { Accept: "text/tab-separated-values" } },
  })
    .then((tsv) => {
      data.value = parseUnits(tsv);
    })
    .catch((e) => {
      loading = undefined;
      console.warn("DinoData: loading units failed", e);
    })
    .finally(() => {
      loadingUnits.value = false;
    });
  loading = { language, promise };
  return promise;
}

export function useUnits() {
  return { units: data, loading: loadingUnits };
}

/** The unit symbol in the user language, else its label, else its ID. */
export function unitSymbol(unit: Unit, language: string): string {
  return (
    term(unit.symbols, language)?.[0] ?? term(unit.labels, language) ?? unit.id
  );
}

export function unitLabel(unit: Unit, language: string): string {
  return term(unit.labels, language) ?? unit.id;
}

export interface UnitMatch {
  unit: Unit;
  /** matches a symbol, label or alias exactly, not only its beginning */
  exact: boolean;
  /** 100 symbol, 90 label or alias, 60 symbol ignoring case, 50 beginning */
  score: number;
  /** allowed for the property */
  allowed: boolean;
}

/** How well a unit matches the text: 100/90 exactly, 60/50 partly, else 0. */
function matchScore(unit: Unit, q: string): number {
  const lower = q.toLowerCase();
  const symbols = Object.values(unit.symbols).flat();
  const names = [
    ...Object.values(unit.labels),
    ...Object.values(unit.aliases).flat(),
  ].map((s) => s.toLowerCase());
  if (symbols.includes(q)) return 100;
  if (names.includes(lower)) return 90;
  if (symbols.some((s) => s.toLowerCase() === lower)) return 60;
  if (
    symbols.some((s) => s.toLowerCase().startsWith(lower)) ||
    names.some((s) => s.startsWith(lower))
  )
    return 50;
  return 0;
}

/** The text is a symbol, label or alias of the unit. */
export const matchesExactly = (unit: Unit, text: string) =>
  matchScore(unit, text.trim()) >= 90;

/**
 * Units matching the text after a number, e.g. "km" or "kilo": symbols
 * exactly (case-sensitive, so "mm" is not "Mm"), labels and aliases ignoring
 * case, then all of them by their beginning. The allowed units of the property
 * come first; others match too, as constraints are not enforced.
 */
export function matchUnits(
  text: string,
  { units, allowed }: UnitData,
  property: string,
  limit = 10,
): UnitMatch[] {
  const q = text.trim();
  if (!q) return [];
  const allowedUnits = new Set(allowed.get(property));
  const scored: [number, UnitMatch][] = [];
  for (const unit of units.values()) {
    const score = matchScore(unit, q);
    if (!score) continue;
    const isAllowed = allowedUnits.has(unit.id);
    scored.push([
      score + (isAllowed ? 1000 : 0),
      { unit, exact: score >= 90, score, allowed: isAllowed },
    ]);
  }
  return scored
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, m]) => m);
}

/**
 * The unit meant by the matches, if unambiguous: the only exact match among
 * the allowed units, else among all; a symbol beats labels and aliases, so
 * "m" is metre even though "M" is an alias of others.
 */
export function resolveUnit(matches: UnitMatch[]): Unit | undefined {
  const exact = matches.filter((m) => m.exact);
  const allowedExact = exact.filter((m) => m.allowed);
  const candidates = allowedExact.length ? allowedExact : exact;
  const best = Math.max(...candidates.map((m) => m.score));
  const top = candidates.filter((m) => m.score === best);
  return top.length === 1 ? top[0].unit : undefined;
}

/** Split "1.85 km" into the number and the text of the unit. */
export function splitQuantity(
  input: string,
): { amount: string; unit: string } | undefined {
  const m = input.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)$/s);
  return m ? { amount: m[1], unit: m[2].trim() } : undefined;
}

export const unitUri = (id: string) => `${ENTITY}${id}`;
