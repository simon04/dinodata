import { describe, expect, it } from "vite-plus/test";
import {
  applyPatch,
  diffTags,
  formatTagText,
  joinValues,
  mergeTags,
  normalizeValue,
  parseTagText,
  patchTo,
  splitValues,
  tagState,
  upgradePatch,
} from "./tags";

describe("normalizeValue", () => {
  it("trims, collapses whitespace and removes empty values", () => {
    expect(normalizeValue("  a   b ")).toBe("a b");
    expect(normalizeValue(" ")).toBeUndefined();
    expect(normalizeValue(undefined)).toBeUndefined();
  });
});

describe("applyPatch and diffTags", () => {
  const base = { amenity: "cafe", name: "A", wifi: "yes" };

  it("sets and removes tags", () => {
    const current = applyPatch(base, {
      name: "B ",
      wifi: undefined,
      cuisine: "coffee_shop",
      opening_hours: "",
    });
    expect(current).toEqual({
      amenity: "cafe",
      name: "B",
      cuisine: "coffee_shop",
    });
    expect(diffTags(base, current)).toEqual([
      { key: "cuisine", old: undefined, new: "coffee_shop" },
      { key: "name", old: "A", new: "B" },
      { key: "wifi", old: "yes", new: undefined },
    ]);
    expect(tagState(base, current, "cuisine")).toBe("added");
    expect(tagState(base, current, "name")).toBe("changed");
    expect(tagState(base, current, "wifi")).toBe("removed");
    expect(tagState(base, current, "amenity")).toBeUndefined();
  });

  it("computes the patch between two tag sets", () => {
    expect(patchTo(base, { amenity: "bar", name: "A" })).toEqual({
      amenity: "bar",
      wifi: undefined,
    });
  });
});

describe("text view", () => {
  it("formats sorted key=value lines", () => {
    expect(formatTagText({ name: "A", amenity: "cafe" })).toBe(
      "amenity=cafe\nname=A",
    );
  });

  it("parses key=value, tabs and quoted lines", () => {
    expect(
      parseTagText(
        'amenity=cafe\n\nname = Café = Bar\nwheelchair\tyes\n"cuisine"="coffee_shop",\ninvalid\n=x',
      ),
    ).toEqual({
      tags: {
        amenity: "cafe",
        name: "Café = Bar",
        wheelchair: "yes",
        cuisine: "coffee_shop",
      },
      invalid: ["invalid", "=x"],
    });
  });
});

describe("splitValues and joinValues", () => {
  it("handles semicolon-separated values", () => {
    expect(splitValues("pizza; pasta;")).toEqual(["pizza", "pasta"]);
    expect(splitValues(undefined)).toEqual([]);
    expect(joinValues(["a", "b"])).toBe("a;b");
    expect(joinValues([])).toBeUndefined();
  });
});

describe("mergeTags", () => {
  const base = { amenity: "cafe", name: "A", wifi: "yes", level: "0" };

  it("merges changes of different keys", () => {
    const mine = { amenity: "cafe", name: "B", wifi: "yes", level: "0" };
    const theirs = { amenity: "cafe", name: "A", level: "1", phone: "1" };
    expect(mergeTags(base, mine, theirs)).toEqual({
      tags: { amenity: "cafe", name: "B", level: "1", phone: "1" },
      conflicts: [],
    });
  });

  it("reports conflicting changes of the same key, same changes merge", () => {
    const mine = { amenity: "bar", name: "B", level: "0" };
    const theirs = { amenity: "pub", name: "B", wifi: "yes", level: "0" };
    expect(mergeTags(base, mine, theirs)).toEqual({
      tags: { amenity: "pub", name: "B", level: "0" },
      conflicts: [{ key: "amenity", old: "pub", new: "bar" }],
    });
  });
});

describe("upgradePatch", () => {
  it("replaces deprecated tags", () => {
    expect(
      upgradePatch(
        { "bicycle:oneway": "no" },
        {
          old: { "bicycle:oneway": "*" },
          replace: { "oneway:bicycle": "$1" },
        },
      ),
    ).toEqual({ "bicycle:oneway": undefined, "oneway:bicycle": "no" });
    expect(
      upgradePatch(
        { amenity: "shop" },
        { old: { amenity: "shop" }, replace: { shop: "*" } },
      ),
    ).toEqual({ amenity: undefined, shop: "yes" });
  });
});
