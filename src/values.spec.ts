import { describe, expect, it } from "vite-plus/test";
import { formatInput, keepOriginal, parseValue } from "./values";
import type { Snak } from "./wikidata";

describe("parseValue", () => {
  it.each([
    ["Q5", "Q5"],
    ["q5", "Q5"],
    ["https://www.wikidata.org/wiki/Q5", "Q5"],
    ["http://www.wikidata.org/entity/Q42", "Q42"],
    ["wd:Q64", "Q64"],
  ])("parses item %s", (input, id) => {
    expect(parseValue("wikibase-item", input)).toEqual({
      type: "wikibase-entityid",
      value: { "entity-type": "item", id },
    });
  });

  it("rejects an ID of the wrong entity type", () => {
    expect(parseValue("wikibase-item", "P31")).toBeUndefined();
    expect(parseValue("wikibase-property", "P31")?.value).toEqual({
      "entity-type": "property",
      id: "P31",
    });
    expect(parseValue("wikibase-lexeme", "L1")?.value).toEqual({
      "entity-type": "lexeme",
      id: "L1",
    });
  });

  it("returns undefined for empty input", () => {
    expect(parseValue("string", "   ")).toBeUndefined();
  });

  describe("time", () => {
    const time = (input: string) =>
      parseValue("time", input)?.value as Record<string, unknown> | undefined;

    it.each([
      ["1955", "+1955-00-00T00:00:00Z", 9],
      ["1955-05", "+1955-05-00T00:00:00Z", 10],
      ["1955-05-15", "+1955-05-15T00:00:00Z", 11],
      ["-44", "-0044-00-00T00:00:00Z", 9],
      ["12345", "+12345-00-00T00:00:00Z", 9],
    ])("parses %s with precision", (input, value, precision) => {
      expect(time(input)).toMatchObject({ time: value, precision });
    });

    it("parses QuickStatements time with precision and Julian calendar", () => {
      expect(time("+1500-00-00T00:00:00Z/7/J")).toMatchObject({
        time: "+1500-00-00T00:00:00Z",
        precision: 7,
        calendarmodel: "http://www.wikidata.org/entity/Q1985786",
      });
      expect(time("+2001-01-01T00:00:00Z/11")?.calendarmodel).toBe(
        "http://www.wikidata.org/entity/Q1985727",
      );
    });

    it.each(["1955-13", "1955-01-32", "+2001-01-01T00:00:00Z/12", "May 1955"])(
      "rejects %s",
      (input) => expect(time(input)).toBeUndefined(),
    );
  });

  describe("quantity", () => {
    it("adds the sign and keeps units", () => {
      expect(parseValue("quantity", "42")?.value).toEqual({
        amount: "+42",
        unit: "1",
      });
      expect(parseValue("quantity", "-1.5")?.value).toMatchObject({
        amount: "-1.5",
      });
      expect(parseValue("quantity", "2994U11573")?.value).toEqual({
        amount: "+2994",
        unit: "http://www.wikidata.org/entity/Q11573",
      });
    });

    it("rejects non-numbers and grouped numbers", () => {
      expect(parseValue("quantity", "forty-two")).toBeUndefined();
      expect(parseValue("quantity", "1,000")).toBeUndefined();
    });
  });

  describe("globe-coordinate", () => {
    it.each(["48.2, 16.37", "48.2/16.37", "@48.2/16.37", "48.2 16.37"])(
      "parses %s",
      (input) =>
        expect(parseValue("globe-coordinate", input)?.value).toMatchObject({
          latitude: 48.2,
          longitude: 16.37,
          globe: "http://www.wikidata.org/entity/Q2",
        }),
    );

    it("rejects coordinates out of range", () => {
      expect(parseValue("globe-coordinate", "91, 0")).toBeUndefined();
      expect(parseValue("globe-coordinate", "0, -181")).toBeUndefined();
    });
  });

  it("parses monolingual text with QuickStatements language prefix", () => {
    expect(parseValue("monolingualtext", 'de:"Wien \\"Mitte\\""')).toEqual({
      type: "monolingualtext",
      value: { text: 'Wien "Mitte"', language: "de" },
    });
    expect(parseValue("monolingualtext", "Vienna", "en")?.value).toEqual({
      text: "Vienna",
      language: "en",
    });
  });

  it("accepts URLs with a scheme only", () => {
    expect(parseValue("url", "https://example.org")?.value).toBe(
      "https://example.org",
    );
    expect(parseValue("url", "example.org")).toBeUndefined();
  });

  it("unquotes QuickStatements strings", () => {
    expect(parseValue("external-id", '"a\\"b"')?.value).toBe('a"b');
    expect(parseValue("string", "plain")?.value).toBe("plain");
  });
});

describe("formatInput", () => {
  it.each([
    ["wikibase-item", "Q5"],
    ["time", "1955"],
    ["time", "1955-05"],
    ["time", "1955-05-15"],
    ["time", "-44"],
    ["quantity", "42"],
    ["globe-coordinate", "48.2, 16.37"],
    ["string", "text"],
  ])("round-trips %s %s", (datatype, input) => {
    expect(formatInput(parseValue(datatype, input))).toBe(input);
  });

  it("keeps low precision times in QuickStatements syntax", () => {
    expect(formatInput(parseValue("time", "+1500-00-00T00:00:00Z/7"))).toBe(
      "+1500-00-00T00:00:00Z/7",
    );
  });

  it("returns an empty string without a value", () => {
    expect(formatInput(undefined)).toBe("");
  });
});

describe("keepOriginal", () => {
  const edit = (datatype: string, original: Snak["datavalue"], input: string) =>
    keepOriginal(parseValue(datatype, input), original, input)?.value;

  it("keeps the unit of a quantity unless a new one is given", () => {
    const original = {
      type: "quantity",
      value: { amount: "+12", unit: "http://www.wikidata.org/entity/Q11573" },
    };
    expect(edit("quantity", original, "15")).toEqual({
      amount: "+15",
      unit: "http://www.wikidata.org/entity/Q11573",
    });
    expect(edit("quantity", original, "15U828224")).toMatchObject({
      unit: "http://www.wikidata.org/entity/Q828224",
    });
  });

  it("moves the bounds of a quantity along with the amount", () => {
    const original = {
      type: "quantity",
      value: {
        amount: "+12",
        upperBound: "+13",
        lowerBound: "+11.5",
        unit: "1",
      },
    };
    expect(edit("quantity", original, "12")).toEqual(original.value);
    expect(edit("quantity", original, "0.1")).toEqual({
      amount: "+0.1",
      upperBound: "+1.1",
      lowerBound: "-0.4",
      unit: "1",
    });
  });

  it("keeps the calendar model of a date", () => {
    const julian = "http://www.wikidata.org/entity/Q1985786";
    const original = parseValue("time", "+1500-01-01T00:00:00Z/11/J");
    expect(edit("time", original, "1501")).toMatchObject({
      calendarmodel: julian,
    });
  });

  it("keeps the globe and precision of coordinates", () => {
    const original = {
      type: "globecoordinate",
      value: {
        latitude: 1,
        longitude: 2,
        precision: 0.01,
        globe: "http://www.wikidata.org/entity/Q405",
      },
    };
    expect(edit("globe-coordinate", original, "3, 4")).toEqual({
      latitude: 3,
      longitude: 4,
      precision: 0.01,
      globe: "http://www.wikidata.org/entity/Q405",
    });
  });

  it("leaves new values alone", () => {
    expect(edit("quantity", undefined, "42")).toEqual({
      amount: "+42",
      unit: "1",
    });
  });
});
