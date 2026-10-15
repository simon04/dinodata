import type { Snak } from "./wikidata";

/**
 * Parse user input for a datatype into a Wikibase datavalue, or undefined if
 * the text does not match the expected format. Accepts the plain formats of
 * the value inputs as well as QuickStatements syntax.
 */
export function parseValue(
  datatype: string,
  input: string,
  language = "en",
): Snak["datavalue"] {
  const v = input.trim();
  if (!v) return undefined;
  const unquoted = v.match(/^"(.*)"$/)?.[1] ?? v;
  switch (datatype) {
    case "wikibase-item":
    case "wikibase-property":
    case "wikibase-lexeme": {
      const prefix = {
        "wikibase-item": "Q",
        "wikibase-property": "P",
        "wikibase-lexeme": "L",
      }[datatype];
      // also accept URLs such as https://www.wikidata.org/wiki/Q5
      const id = v
        .match(new RegExp(`(?:^|[/:#=])(${prefix}\\d+)/?$`, "i"))?.[1]
        .toUpperCase();
      if (!id) return undefined;
      const entityType = datatype.replace("wikibase-", "");
      return {
        type: "wikibase-entityid",
        value: { "entity-type": entityType, id },
      };
    }
    case "time": {
      // 1955, 1955-05, 1955-05-15, or QuickStatements +1955-05-15T00:00:00Z/11
      const qs = v.match(
        /^([+-]?)(\d{1,16})-(\d\d)-(\d\d)T00:00:00Z\/(\d{1,2})$/,
      );
      const m = qs ?? v.match(/^(-?)(\d{1,4})(?:-(\d\d))?(?:-(\d\d))?$/);
      if (!m) return undefined;
      const [, sign, year, month, day] = m;
      const precision = qs ? Number(qs[5]) : day ? 11 : month ? 10 : 9;
      if (precision > 11 || Number(month ?? 0) > 12 || Number(day ?? 0) > 31)
        return undefined;
      return {
        type: "time",
        value: {
          time: `${sign === "-" ? "-" : "+"}${year.padStart(4, "0")}-${month ?? "00"}-${day ?? "00"}T00:00:00Z`,
          precision,
          timezone: 0,
          before: 0,
          after: 0,
          calendarmodel: "http://www.wikidata.org/entity/Q1985727",
        },
      };
    }
    case "quantity": {
      // 42, 1.5, or QuickStatements 2994U11573
      const m = v.match(/^([+-]?\d+(?:\.\d+)?)(?:U(\d+))?$/);
      if (!m) return undefined;
      const amount = /^[+-]/.test(m[1]) ? m[1] : `+${m[1]}`;
      const unit = m[2] ? `http://www.wikidata.org/entity/Q${m[2]}` : "1";
      return { type: "quantity", value: { amount, unit } };
    }
    case "globe-coordinate": {
      // 48.2, 16.37 or QuickStatements @48.2/16.37
      const m = v.match(/^@?(-?\d+(?:\.\d+)?)\s*[,;/\s]\s*(-?\d+(?:\.\d+)?)$/);
      if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return undefined;
      return {
        type: "globecoordinate",
        value: {
          latitude: Number(m[1]),
          longitude: Number(m[2]),
          precision: 0.0001,
          globe: "http://www.wikidata.org/entity/Q2",
        },
      };
    }
    case "monolingualtext": {
      // QuickStatements en:"text", otherwise the given language
      const m = v.match(/^([a-z][a-z0-9-]*):"(.*)"$/);
      return {
        type: "monolingualtext",
        value: m
          ? { text: m[2], language: m[1] }
          : { text: unquoted, language },
      };
    }
    case "url":
      return /^\w+:\/\/./.test(unquoted)
        ? { type: "string", value: unquoted }
        : undefined;
  }
  return { type: "string", value: unquoted };
}

/** Human-readable example of the expected format, for error messages. */
export const FORMAT_EXAMPLES: Record<string, string> = {
  "wikibase-item": "Q5",
  "wikibase-property": "P31",
  "wikibase-lexeme": "L1",
  time: "1955-05-15",
  quantity: "42",
  "globe-coordinate": "48.2, 16.37",
  monolingualtext: 'en:"text"',
  url: "https://…",
};
