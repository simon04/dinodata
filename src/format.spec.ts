import { describe, expect, it } from "vite-plus/test";
import { formatNumber, formatTime } from "./format";

describe("formatNumber", () => {
  it("groups digits per locale", () => {
    expect(formatNumber("+1505005", "en")).toBe("1,505,005");
    expect(formatNumber(1505005, "de")).toBe("1.505.005");
  });

  it("keeps all decimals of Wikibase amounts", () => {
    expect(formatNumber("+0.000123456789", "en")).toBe("0.000123456789");
  });

  it("falls back to English for codes unknown to Intl", () => {
    expect(formatNumber(1234.5, "not a language")).toBe("1,234.5");
  });
});

describe("formatTime", () => {
  const time = "+1952-03-11T00:00:00Z";

  it.each([
    [11, "en", "March 11, 1952"],
    [10, "en", "March 1952"],
    [9, "en", "1952"],
    [11, "de", "11. März 1952"],
  ])("precision %i in %s", (precision, language, expected) => {
    expect(formatTime(time, precision, language)).toBe(expected);
  });

  it("formats years BCE with an era", () => {
    expect(formatTime("-0044-03-15T00:00:00Z", 11, "en")).toBe(
      "March 15, 44 BC",
    );
  });

  it("does not shift two-digit years into the 20th century", () => {
    expect(formatTime("+0079-00-00T00:00:00Z", 9, "en")).toBe("79");
  });

  it.each([
    ["+1950-00-00T00:00:00Z", 8, "1950s"],
    ["+1801-00-00T00:00:00Z", 7, "19th century"],
    ["+1900-00-00T00:00:00Z", 7, "19th century"],
    ["+1901-00-00T00:00:00Z", 7, "20th century"],
    ["+2001-00-00T00:00:00Z", 7, "21st century"],
    ["+2000-00-00T00:00:00Z", 6, "2nd millennium"],
    ["-0500-00-00T00:00:00Z", 7, "5th century BCE"],
    ["-13798000000-00-00T00:00:00Z", 3, "13,798,000,000 years BCE"],
  ])("%s with precision %i", (value, precision, expected) => {
    expect(formatTime(value, precision, "en")).toBe(expected);
  });

  it("uses numeric ordinals for other languages", () => {
    // untranslated messages fall back to English
    expect(formatTime("+1801-00-00T00:00:00Z", 7, "de")).toBe("19. century");
  });

  it("returns unparsable values unchanged", () => {
    expect(formatTime("yesterday", 11, "en")).toBe("yesterday");
  });
});
