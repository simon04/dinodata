import { describe, expect, it } from "vite-plus/test";
import {
  matchUnits,
  parseUnits,
  resolveUnit,
  splitQuantity,
  unitSymbol,
} from "./units";

const E = "<http://www.wikidata.org/entity/";
const TSV = [
  "?p\t?u\t?k\t?t",
  `${E}P2048>\t${E}Q11573>\t\t`,
  `${E}P2048>\t${E}Q174728>\t\t`,
  `${E}P1082>\t\t\t`,
  `\t${E}Q11573>\t"l"\t"metre"@en`,
  `\t${E}Q11573>\t"l"\t"Meter"@de`,
  `\t${E}Q11573>\t"s"\t"m"@mul`,
  `\t${E}Q11573>\t"a"\t"meter"@en`,
  `\t${E}Q174728>\t"l"\t"centimetre"@en`,
  `\t${E}Q174728>\t"s"\t"cm"@en`,
  `\t${E}Q7727>\t"l"\t"minute"@en`,
  `\t${E}Q7727>\t"s"\t"min"@en`,
  `\t${E}Q842015>\t"l"\t"megametre"@en`,
  `\t${E}Q842015>\t"s"\t"Mm"@en`,
  `\t${E}Q11570>\t"l"\t"kilogram"@en`,
  `\t${E}Q11570>\t"s"\t"kg"@en`,
  `\t${E}Q100995>\t"l"\t"pound"@en`,
  `\t${E}Q100995>\t"s"\t"lb"@en`,
  `\t${E}Q4916>\t"l"\t"euro"@en`,
  `\t${E}Q4916>\t"s"\t"€"@en`,
  `\t${E}Q25224>\t"l"\t"pound sterling"@en`,
  `\t${E}Q25224>\t"s"\t"£"@en`,
  `\t${E}Q25224>\t"a"\t"pound"@en`,
].join("\n");
const data = parseUnits(TSV);
const ids = (text: string, property = "P2048") =>
  matchUnits(text, data, property).map((m) => m.unit.id);

describe("parseUnits", () => {
  it("reads the allowed units of properties, empty for no unit", () => {
    expect(data.allowed.get("P2048")).toEqual(["Q11573", "Q174728"]);
    expect(data.allowed.get("P1082")).toEqual([]);
    expect(data.allowed.has("P31")).toBe(false);
  });

  it("reads labels, aliases and symbols per language", () => {
    expect(data.units.get("Q11573")).toEqual({
      id: "Q11573",
      labels: { en: "metre", de: "Meter" },
      aliases: { en: ["meter"] },
      symbols: { mul: ["m"] },
    });
    expect(unitSymbol(data.units.get("Q11573")!, "de")).toBe("m");
    expect(unitSymbol(data.units.get("Q7727")!, "de")).toBe("min");
  });
});

describe("splitQuantity", () => {
  it.each([
    ["1.85 m", "1.85", "m"],
    ["185cm", "185", "cm"],
    ["-3", "-3", ""],
    [" 42  pound sterling ", "42", "pound sterling"],
  ])("splits %s", (input, amount, unit) => {
    expect(splitQuantity(input)).toEqual({ amount, unit });
  });

  it("needs a number first", () => {
    expect(splitQuantity("m 3")).toBeUndefined();
  });
});

describe("matchUnits", () => {
  it("matches symbols case-sensitively, labels and aliases ignoring case", () => {
    expect(ids("m")[0]).toBe("Q11573");
    expect(ids("Mm")[0]).toBe("Q842015");
    expect(ids("Meter")[0]).toBe("Q11573");
    expect(ids("CENTIMETRE")).toEqual(["Q174728"]);
  });

  it("lists the allowed units first", () => {
    expect(ids("me")).toEqual(["Q11573", "Q842015"]);
    const megametre = { ...data, allowed: new Map([["P9", ["Q842015"]]]) };
    expect(matchUnits("me", megametre, "P9").map((m) => m.unit.id)).toEqual([
      "Q842015",
      "Q11573",
    ]);
    expect(matchUnits("cm", data, "P2048")[0].allowed).toBe(true);
  });

  it("matches the beginning", () => {
    expect(ids("centi")).toEqual(["Q174728"]);
    expect(ids("kilo")).toEqual(["Q11570"]);
  });
});

describe("resolveUnit", () => {
  const resolve = (text: string, property = "P2048") =>
    resolveUnit(matchUnits(text, data, property))?.id;

  it("takes the only exact match", () => {
    expect(resolve("cm")).toBe("Q174728");
    expect(resolve("kg")).toBe("Q11570");
    expect(resolve("€")).toBe("Q4916");
  });

  it("is undefined for partial matches", () => {
    expect(resolve("kilo")).toBeUndefined();
    expect(resolve("M")).toBeUndefined();
  });

  it("is undefined for ambiguous names", () => {
    // pound (mass) and pound sterling (alias)
    expect(resolve("pound")).toBeUndefined();
  });
});
