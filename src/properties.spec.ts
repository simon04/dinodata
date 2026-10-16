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
/** SPARQL TSV rows: property, type, kind of text, text, formatter URL */
const rows = [
  [`<${E}/P31>`, `<${O}WikibaseItem>`, '"l"', '"instance of"@en', ""],
  [`<${E}/P31>`, `<${O}WikibaseItem>`, '"a"', '"is a"@en', ""],
  [`<${E}/P31>`, `<${O}WikibaseItem>`, '"l"', '"ist ein(e)"@de', ""],
  [`<${E}/P31>`, `<${O}WikibaseItem>`, '"d"', '"type of"@en', ""],
  [`<${E}/P279>`, `<${O}WikibaseItem>`, '"l"', '"subclass of"@en', ""],
  [`<${E}/P279>`, `<${O}WikibaseItem>`, '"a"', '"is a type of"@en', ""],
  [`<${E}/P1082>`, `<${O}Quantity>`, '"l"', '"population"@en', ""],
  [
    `<${E}/P214>`,
    `<${O}ExternalId>`,
    '"l"',
    '"VIAF ID"@en',
    '"https://viaf.org/viaf/$1"',
  ],
  [`<${E}/P9>`, `<${O}SomethingNew>`, '"l"', '"tab\\there"@en', ""],
  [`<${E}/P10>`, `<${O}Url>`, "", "", ""],
];
const tsv = ["?p\t?type\t?k\t?t\t?f", ...rows.map((r) => r.join("\t"))].join(
  "\n",
);

/** requests made, kept across tests */
const requests: [string, RequestInit | undefined][] = [];
const fetch = async (url: string, init?: RequestInit) => {
  requests.push([url, init]);
  return new Response(tsv);
};
const language = ref("de");
const { properties, byId, loading } = useProperties();

beforeAll(async () => {
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", fakeCaches());
  loadProperties(language);
  await vi.waitFor(() => expect(properties.value).toHaveLength(6));
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("loadProperties", () => {
  it("parses SPARQL TSV, sorted numerically by ID", () => {
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
    expect(byId.value.P9.labels.en).toBe("tab\there");
  });

  it("queries English and the user language as TSV", () => {
    const [url, init] = requests[0];
    expect(decodeURIComponent(url)).toContain('IN ("en", "de")');
    expect(init?.headers).toEqual({ Accept: "text/tab-separated-values" });
    expect(loading.value).toBe(false);
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
    language.value = "en";
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await vi.waitFor(() => expect(ids("ist ein")).toEqual([]));
    expect(decodeURIComponent(requests[1][0])).toContain('IN ("en")');
  });
});
