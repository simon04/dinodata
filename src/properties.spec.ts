import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { ref } from "vue";
import {
  loadProperties,
  propertyDescription,
  propertyLabel,
  searchProperties,
  useProperties,
} from "./properties";
import { fakeCaches } from "./testing/fake-caches";

const E = "http://www.wikidata.org/entity";
const O = "http://wikiba.se/ontology#";
/** SPARQL TSV rows: property, type, formatter URL */
const rows = [
  [`<${E}/P31>`, `<${O}WikibaseItem>`, ""],
  [`<${E}/P279>`, `<${O}WikibaseItem>`, ""],
  [`<${E}/P1082>`, `<${O}Quantity>`, ""],
  [`<${E}/P214>`, `<${O}ExternalId>`, '"https://viaf.org/viaf/$1"'],
  [`<${E}/P214>`, `<${O}ExternalId>`, '"https://viaf.org/other/$1"'],
  [`<${E}/P9>`, `<${O}SomethingNew>`, '"tab\\there"'],
  [`<${E}/P10>`, `<${O}Url>`, ""],
];
const tsv = ["?p\t?type\t?f", ...rows.map((r) => r.join("\t"))].join("\n");

/** API terms by language and property */
const terms: Record<string, Record<string, Record<string, string[]>>> = {
  en: {
    P31: { label: ["instance of"], description: ["type of"], alias: ["is a"] },
    P279: { label: ["subclass of"], alias: ["is a type of"] },
    P1082: { label: ["population"] },
    P214: { label: ["VIAF ID"] },
    P9: { label: ["something new"] },
    P10: { label: ["video"] },
    // a property without datatype is not exposed
    P99: { label: ["no type"] },
  },
  de: { P31: { label: ["ist ein(e)"] }, P1082: { label: ["Einwohnerzahl"] } },
};

/** Fake API: one page per request, filtered by prefix. */
function api(params: URLSearchParams) {
  const prefix = params.get("gapprefix")!;
  const ids = Object.keys(terms[params.get("wbetlanguage")!])
    .filter((id) => id.startsWith(prefix))
    .sort();
  const from = params.get("gapcontinue");
  const pages = (from ? ids.filter((id) => id >= from) : ids)
    .slice(0, 1)
    .map((id) => ({
      title: `Property:${id}`,
      entityterms: terms[params.get("wbetlanguage")!][id],
    }));
  const last = pages[0]?.title.slice("Property:".length) ?? "";
  const rest = ids.filter((id) => id > last);
  return Response.json({
    query: { pages },
    ...(rest.length && { continue: { gapcontinue: rest[0] } }),
  });
}

/** requests made, kept across tests */
const requests: [string, RequestInit | undefined][] = [];
const fetch = async (url: string, init?: RequestInit) => {
  requests.push([url, init]);
  const { searchParams } = new URL(url);
  return searchParams.has("query") ? new Response(tsv) : api(searchParams);
};
const sparql = () => requests.filter(([url]) => url.includes("sparql"));
const apiRequests = (language: string) =>
  requests
    .map(([url]) => new URL(url).searchParams)
    .filter((p) => p.get("wbetlanguage") === language);
const language = ref("de");
const { properties, byId, loading } = useProperties();

beforeAll(async () => {
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", fakeCaches());
  loadProperties(language);
  await vi.waitFor(() => expect(loading.value).toBe(false));
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("loadProperties", () => {
  it("merges types and terms, sorted numerically by ID", () => {
    expect(properties.value.map((p) => p.id)).toEqual([
      "P9",
      "P10",
      "P31",
      "P214",
      "P279",
      "P1082",
    ]);
    expect(byId.value.P31).toEqual({
      id: "P31",
      datatype: "wikibase-item",
      labels: { en: "instance of", de: "ist ein(e)" },
      descriptions: { en: "type of" },
      aliases: { en: ["is a"] },
    });
  });

  it("maps datatypes, formatter URLs and escapes", () => {
    expect(byId.value.P214).toMatchObject({
      datatype: "external-id",
      formatterUrl: "https://viaf.org/viaf/$1",
    });
    expect(byId.value.P1082.datatype).toBe("quantity");
    expect(byId.value.P10.datatype).toBe("url");
    // unknown types are kept as-is
    expect(byId.value.P9.datatype).toBe("SomethingNew");
    expect(byId.value.P9.formatterUrl).toBe("tab\there");
  });

  it("queries types as TSV and terms per prefix, following continuation", () => {
    expect(sparql()).toHaveLength(1);
    expect(sparql()[0][1]?.headers).toEqual({
      Accept: "text/tab-separated-values",
    });
    const en = apiRequests("en");
    // P10, continued with P1082
    expect(en.filter((p) => p.get("gapprefix") === "P1")).toHaveLength(2);
    expect(en.map((p) => p.get("gapprefix"))).toEqual(
      expect.arrayContaining(["P2", "P3", "P9"]),
    );
    expect(apiRequests("de")).toHaveLength(9);
  });
});

describe("propertyLabel", () => {
  it("falls back to English", () => {
    expect(propertyLabel(byId.value.P31, "de")).toBe("ist ein(e)");
    expect(propertyLabel(byId.value.P31, "fr")).toBe("instance of");
    expect(propertyLabel(undefined, "de")).toBeUndefined();
  });
});

describe("propertyDescription", () => {
  it("falls back to English", () => {
    expect(propertyDescription(byId.value.P31, "de")).toBe("type of");
    expect(propertyDescription(undefined, "de")).toBeUndefined();
  });
});

describe("searchProperties", () => {
  const ids = (q: string, limit?: number) =>
    searchProperties(q, limit).map((p) => p.id);

  it.each(["P31", "p31", "31"])("finds %s by ID first", (q) => {
    expect(ids(q)[0]).toBe("P31");
  });

  it.each([
    "https://www.wikidata.org/wiki/Property:P31",
    "http://www.wikidata.org/entity/P31",
    "http://www.wikidata.org/prop/direct/P31",
  ])("finds only the property for the URL %s", (q) => {
    expect(ids(q)).toEqual(["P31"]);
  });

  it("ranks exact aliases over alias prefixes", () => {
    // P31 has the alias "is a", P279 the alias "is a type of"
    expect(ids("is a")).toEqual(["P31", "P279"]);
    expect(ids("subclass of")).toEqual(["P279"]);
  });

  it("searches labels in the user language and English", () => {
    expect(ids("ist ein")).toEqual(["P31"]);
    expect(ids("VIAF")).toEqual(["P214"]);
  });

  it("matches word starts before substrings", () => {
    // "of" starts a word in "instance of" and "subclass of"
    expect(ids("of")).toEqual(["P31", "P279"]);
    expect(ids("ulation")).toEqual(["P1082"]);
  });

  it("respects the limit and ignores empty input", () => {
    expect(ids("of", 1)).toEqual(["P31"]);
    expect(ids("  ")).toEqual([]);
  });

  it("reloads for another language", async () => {
    const before = requests.length;
    language.value = "en";
    await vi.waitFor(() => expect(ids("ist ein")).toEqual([]));
    await vi.waitFor(() => expect(loading.value).toBe(false));
    // types and English terms come from the cache
    expect(requests).toHaveLength(before);
  });
});
