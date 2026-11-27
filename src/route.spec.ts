import { describe, expect, it } from "vite-plus/test";
import { contributionsHash, lookupHash, parseRoute } from "./route";

describe("parseRoute", () => {
  it("parses items and comparisons", () => {
    expect(parseRoute("#Q40")).toEqual({ mode: "wikidata", id: "Q40" });
    expect(parseRoute("#Q40?compare=Q41")).toEqual({
      mode: "wikidata",
      id: "Q40",
      compare: "Q41",
    });
  });

  it("parses lookups by statement value", () => {
    expect(parseRoute("#P954=8100002")).toEqual({
      mode: "wikidata",
      lookup: { property: "P954", value: "8100002" },
    });
    expect(parseRoute(lookupHash("P1671", "101 01"))).toEqual({
      mode: "wikidata",
      lookup: { property: "P1671", value: "101 01" },
    });
    expect(lookupHash("P1671", "101 01")).toBe("#P1671=101%2001");
  });

  it("parses contributions of a user", () => {
    expect(parseRoute("#contributions/Simon04")).toEqual({
      mode: "wikidata",
      contributions: "Simon04",
    });
    expect(contributionsHash("Some User")).toBe("#contributions/Some_User");
    expect(parseRoute(contributionsHash("Some User/ä"))).toEqual({
      mode: "wikidata",
      contributions: "Some User/ä",
    });
  });
});
