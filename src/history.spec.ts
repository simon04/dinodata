import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { entityDiff, getTagNames, tokenize } from "./history";
import type { Claim, Entity } from "./wikidata";
import { fakeCaches } from "./testing/fake-caches";

afterEach(() => {
  vi.unstubAllGlobals();
});

const entity = (extra: Partial<Entity>): Entity => ({
  id: "Q1",
  labels: {},
  descriptions: {},
  aliases: {},
  claims: {},
  ...extra,
});
const claim = (id: string, value: string, extra: Partial<Claim> = {}) =>
  ({
    id,
    rank: "normal",
    mainsnak: {
      snaktype: "value",
      property: "P31",
      datavalue: { type: "wikibase-entityid", value: { id: value } },
    },
    ...extra,
  }) as Claim;

describe("entityDiff", () => {
  it("returns removed and added QuickStatements lines", () => {
    const before = entity({
      labels: { en: { value: "old" }, de: { value: "gleich" } },
      claims: { P31: [claim("a", "Q5"), claim("b", "Q6")] },
    });
    const after = entity({
      labels: { en: { value: "new" }, de: { value: "gleich" } },
      aliases: { en: [{ value: "alias" }] },
      claims: {
        P31: [claim("a", "Q5"), claim("b", "Q6", { rank: "preferred" })],
      },
      sitelinks: { dewiki: { site: "dewiki", title: "Eins" } },
    });
    expect(entityDiff(before, after)).toEqual([
      { type: "-", text: 'Q1|Len|"old"' },
      { type: "-", text: "Q1|P31|Q6" },
      { type: "+", text: 'Q1|Len|"new"' },
      { type: "+", text: 'Q1|Aen|"alias"' },
      { type: "+", text: "Q1|P31|Q6|R+" },
      { type: "+", text: 'Q1|Sdewiki|"Eins"' },
    ]);
  });

  it("counts duplicate statements", () => {
    const twice = entity({
      claims: { P31: [claim("a", "Q5"), claim("b", "Q5")] },
    });
    const once = entity({ claims: { P31: [claim("a", "Q5")] } });
    expect(entityDiff(twice, once)).toEqual([{ type: "-", text: "Q1|P31|Q5" }]);
  });

  it("adds everything on creation", () => {
    expect(
      entityDiff(undefined, entity({ claims: { P31: [claim("a", "Q5")] } })),
    ).toEqual([{ type: "+", text: "Q1|P31|Q5" }]);
  });
});

describe("tokenize", () => {
  it("links entity IDs, also of reference properties and units", () => {
    expect(tokenize('Q1|P1082|5U11573|S248|Q2|P1476|en:"Q3 in text"')).toEqual([
      { text: "Q1", id: "Q1" },
      { text: "|" },
      { text: "P1082", id: "P1082" },
      { text: "|5" },
      { text: "U11573", id: "Q11573" },
      { text: "|" },
      { text: "S248", id: "P248" },
      { text: "|" },
      { text: "Q2", id: "Q2" },
      { text: "|" },
      { text: "P1476", id: "P1476" },
      { text: "|en:" },
      { text: '"Q3 in text"' },
    ]);
  });

  it("does not link terms and sitelinks", () => {
    expect(tokenize('Q1|Len|"x"').map((p) => p.id)).toEqual([
      "Q1",
      undefined,
      undefined,
    ]);
  });
});

describe("getTagNames", () => {
  it("returns display names of tags as text", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        query: {
          allmessages: [
            {
              name: "tag-OAuth CID: 19784",
              content: "DinoData (dev) &#91;0.1&#93;",
            },
            { name: "tag-hidden", content: "-" },
            { name: "tag-unknown", missing: true },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("caches", fakeCaches());
    expect(
      await getTagNames(["OAuth CID: 19784", "hidden", "unknown"], "en"),
    ).toEqual({ "OAuth CID: 19784": "DinoData (dev) [0.1]" });
    expect(await getTagNames([], "en")).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
