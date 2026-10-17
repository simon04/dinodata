import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { fakeCaches } from "../testing/fake-caches";
import type { Entity } from "../wikidata";
import { getTagDocs, toTagDoc, wikiUrl } from "./osmwiki";

const item = (value: string) => ({
  mainsnak: {
    snaktype: "value" as const,
    property: "",
    datavalue: { type: "wikibase-entityid", value: { id: value } },
  },
  rank: "normal" as const,
  id: "",
});
const str = (value: string, rank: "normal" | "preferred" = "normal") => ({
  mainsnak: {
    snaktype: "value" as const,
    property: "",
    datavalue: { type: "string", value },
  },
  rank,
  id: "",
});

const residential: Entity = {
  id: "Q5043",
  labels: { mul: { value: "highway=residential" } },
  descriptions: {
    en: { value: "Road in a residential area" },
    de: { value: "Anliegerstraße" },
  },
  aliases: {},
  sitelinks: { wiki: { site: "wiki", title: "Tag:highway=residential" } },
  claims: {
    P19: [str("highway=residential")],
    P6: [item("Q5061")],
    P17: [item("Q1")],
    P28: [str("Other.jpg"), str("Residential.jpg", "preferred")],
    P33: [item("Q8001")],
    P34: [item("Q8000")],
    P13: [str("^[a-z]+$")],
    P31: [
      {
        ...str(""),
        mainsnak: {
          snaktype: "value",
          property: "P31",
          datavalue: {
            type: "monolingualtext",
            value: { text: "DE:Tag:highway=residential", language: "de" },
          },
        },
      },
    ],
  },
};

describe("toTagDoc", () => {
  it("parses statements of a tag item", () => {
    expect(toTagDoc(residential, "de")).toMatchObject({
      item: "Q5043",
      page: "Tag:highway=residential",
      description: "Anliegerstraße",
      status: "Q5061",
      discouraged: true,
      image: "Residential.jpg",
      regex: "^[a-z]+$",
      appliesTo: { node: false, way: true },
      replacedBy: ["Q1"],
      localPage: "DE:Tag:highway=residential",
    });
    expect(toTagDoc(residential, "fr").description).toBe(
      "Road in a residential area",
    );
  });
});

describe("wikiUrl", () => {
  it("keeps colons and uses underscores", () => {
    expect(wikiUrl("Key:opening hours")).toBe(
      "https://wiki.openstreetmap.org/wiki/Key:opening_hours",
    );
  });
});

describe("getTagDocs", () => {
  const fetch = vi.fn(async (input: string | URL) => {
    const titles = new URL(input).searchParams.get("titles")!.split("|");
    expect(titles).toEqual([
      "Key:highway",
      "Tag:highway=residential",
      "Key:name",
    ]);
    return Response.json({
      entities: { Q5043: residential, "-1": { missing: "" } },
    });
  });
  beforeEach(() => {
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("caches", fakeCaches());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("looks up keys and tags, not free text values", async () => {
    const docs = await getTagDocs(
      { highway: "residential", name: "Main Street" },
      "en",
    );
    expect(Object.keys(docs)).toEqual(["highway=residential"]);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("sites")).toBe(
      "wiki",
    );
  });
});
