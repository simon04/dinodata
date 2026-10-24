import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { fakeCaches } from "./testing/fake-caches";
import {
  description,
  getBacklinks,
  getEntities,
  fallbackLanguages,
  getLabels,
  label,
  searchEntities,
} from "./wikidata";

/** Fake API: every requested ID gets an English label "label of <id>". */
const fetch = vi.fn(async (input: string | URL) => {
  const url = new URL(input);
  const params = url.searchParams;
  if (params.get("generator") === "backlinks")
    return Response.json(
      params.get("gblcontinue")
        ? { query: { pages: [{ ns: 146, title: "Lexeme:L1" }] } }
        : {
            query: {
              pages: [
                {
                  ns: 0,
                  title: "Q1",
                  entityterms: { label: ["one"], description: ["first"] },
                },
                { ns: 120, title: "Property:P2" },
                { ns: 4, title: "Wikidata:Sandbox" },
              ],
            },
            continue: { gblcontinue: "0|2", continue: "gblcontinue||" },
          },
    );
  if (params.get("action") === "wbsearchentities")
    return Response.json({
      search:
        params.get("search") === "NL hackathon"
          ? []
          : [{ id: "Q1735", label: params.get("search") }],
    });
  if (params.get("list") === "search")
    return Response.json({
      query: {
        search:
          params.get("srnamespace") === "120"
            ? [{ title: "Property:P2", snippet: "" }]
            : [
                {
                  title: "Q2",
                  snippet: 'second <span class="searchmatch">hackathon</span>',
                },
                {
                  title: "Q3",
                  snippet: 'a <span class="searchmatch">NL</span> one',
                },
              ],
      },
    });
  const entities = Object.fromEntries(
    params
      .get("ids")!
      .split("|")
      .map((id) => [
        id,
        id === "Q404"
          ? { id, missing: "" }
          : {
              id,
              labels: { en: { value: `label of ${id}` } },
              descriptions:
                id === "Q2" ? { en: { value: `description of ${id}` } } : {},
            },
      ]),
  );
  return Response.json({ entities });
});
const params = (call: number) =>
  new URL(fetch.mock.calls[call][0]).searchParams;

beforeEach(() => {
  fetch.mockClear();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", fakeCaches());
});
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("fallbackLanguages", () => {
  it("falls back to multilingual, then English", () => {
    expect(fallbackLanguages("de")).toEqual(["de", "mul", "en"]);
    expect(fallbackLanguages("en")).toEqual(["en", "mul"]);
    expect(fallbackLanguages("mul")).toEqual(["mul", "en"]);
  });
});

describe("label", () => {
  const entity = {
    labels: { de: { value: "Wien" }, en: { value: "Vienna" } },
  };

  it("prefers the language, then multilingual, then English", () => {
    expect(label(entity, "de")).toBe("Wien");
    expect(label(entity, "fr")).toBe("Vienna");
    const mul = { labels: { ...entity.labels, mul: { value: "Wien (mul)" } } };
    expect(label(mul, "fr")).toBe("Wien (mul)");
    expect(label(mul, "en")).toBe("Vienna");
    expect(label({ labels: {} }, "de")).toBeUndefined();
    expect(label(undefined, "de")).toBeUndefined();
  });
});

describe("searchEntities", () => {
  it("searches in the user language for CORS-enabled JSON", async () => {
    expect(await searchEntities("Innsbruck", "de", "item")).toEqual([
      { id: "Q1735", label: "Innsbruck" },
    ]);
    expect(Object.fromEntries(params(0))).toMatchObject({
      action: "wbsearchentities",
      search: "Innsbruck",
      language: "de",
      uselang: "de",
      type: "item",
      origin: "*",
      format: "json",
    });
  });
});

describe("searchEntities full-text fallback", () => {
  it("searches the full text when the prefix search finds nothing", async () => {
    expect(await searchEntities("NL hackathon", "de")).toEqual([
      { id: "Q2", label: "label of Q2", description: "description of Q2" },
      // the snippet without markup, if there is no description
      { id: "Q3", label: "label of Q3", description: "a NL one" },
    ]);
    expect(Object.fromEntries(params(1))).toMatchObject({
      list: "search",
      srsearch: "NL hackathon",
      srnamespace: "0",
    });
    expect(params(2).get("ids")).toBe("Q2|Q3");
    expect(params(2).get("languages")).toBe("de|mul|en");
  });

  it("searches properties in their namespace", async () => {
    expect(await searchEntities("NL hackathon", "en", "property")).toEqual([
      { id: "P2", label: "label of P2", description: undefined },
    ]);
    expect(params(1).get("srnamespace")).toBe("120");
  });
});

describe("getEntities", () => {
  it("requests at most 50 IDs at a time and merges the results", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
    const entities = await getEntities(ids, "labels", ["de", "en"]);
    expect(Object.keys(entities)).toHaveLength(120);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(params(2).get("ids")!.split("|")).toHaveLength(20);
    expect(params(0).get("languages")).toBe("de|en");
  });

  it("caches responses unless bypassed", async () => {
    await getEntities(["Q1"]);
    await getEntities(["Q1"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await getEntities(["Q1"], undefined, undefined, true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("description", () => {
  it("falls back to English", () => {
    const entity = { descriptions: { en: { value: "capital of Austria" } } };
    expect(description(entity, "de")).toBe("capital of Austria");
    expect(description({ descriptions: {} }, "de")).toBeUndefined();
    expect(description(undefined, "de")).toBeUndefined();
  });
});

describe("getLabels", () => {
  it("streams cached labels first, then fetched ones", async () => {
    sessionStorage.setItem("dinodata:label:de:Q1", "cached");
    sessionStorage.setItem("dinodata:description:de:Q1", "");
    const batches: Record<string, string>[][] = [];
    await getLabels(["Q1", "Q2"], "de", (...batch) => batches.push(batch));
    expect(batches).toEqual([
      [{ Q1: "cached" }, {}],
      [{ Q2: "label of Q2" }, { Q2: "description of Q2" }],
    ]);
    expect(params(0).get("ids")).toBe("Q2");
    expect(params(0).get("props")).toBe("labels|descriptions");
    expect(params(0).get("languages")).toBe("de|mul|en");
    // now cached in the session, including the description
    const onLabels = vi.fn();
    await getLabels(["Q2"], "de", onLabels);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onLabels).toHaveBeenCalledWith(
      { Q2: "label of Q2" },
      { Q2: "description of Q2" },
    );
  });

  it("refetches labels cached without a description", async () => {
    sessionStorage.setItem("dinodata:label:de:Q2", "cached");
    await getLabels(["Q2"], "de", () => {});
    expect(params(0).get("ids")).toBe("Q2");
  });

  it("uses the ID when an entity has no label", async () => {
    const onLabels = vi.fn();
    await getLabels(["Q404"], "en", onLabels);
    expect(onLabels).toHaveBeenCalledWith({ Q404: "Q404" }, {});
  });

  it("does not call back without anything cached", async () => {
    const onLabels = vi.fn();
    await getLabels([], "en", onLabels);
    expect(onLabels).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("getBacklinks", () => {
  it("caches responses", async () => {
    await getBacklinks("Q42", "de");
    const calls = fetch.mock.calls.length;
    await getBacklinks("Q42", "de");
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it("returns entity IDs, terms and other pages, then continues", async () => {
    const first = await getBacklinks("Q42", "de");
    expect(params(0).get("gbltitle")).toBe("Q42");
    expect(params(0).get("wbetlanguage")).toBe("de");
    expect(first.pages).toEqual([
      { title: "Q1", id: "Q1", label: "one", description: "first" },
      // completed in the fallback languages
      { title: "Property:P2", id: "P2", label: "label of P2" },
      { title: "Wikidata:Sandbox" },
    ]);
    expect(params(1).get("ids")).toBe("P2");
    expect(params(1).get("languages")).toBe("de|mul|en");
    const second = await getBacklinks("Q42", "de", first.next);
    expect(params(2).get("gblcontinue")).toBe("0|2");
    expect(second).toEqual({ pages: [{ title: "Lexeme:L1", id: "L1" }] });
  });

  it("uses the page title of properties and lexemes", async () => {
    await getBacklinks("P31", "en");
    await getBacklinks("L7", "en");
    const titles = fetch.mock.calls
      .map(([url]) => new URL(url).searchParams.get("gbltitle"))
      .filter(Boolean);
    expect(titles).toEqual(["Property:P31", "Lexeme:L7"]);
  });
});
