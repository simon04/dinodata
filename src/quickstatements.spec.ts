import { describe, expect, it } from "vite-plus/test";
import { snakValue, toQuickStatements, type Edit } from "./quickstatements";
import type { Snak } from "./wikidata";

const snak = (property: string, type: string, value: unknown): Snak => ({
  snaktype: "value",
  property,
  datavalue: { type, value },
});
const item = (property: string, id: string) =>
  snak(property, "wikibase-entityid", { "entity-type": "item", id });
const quantity = (property: string, amount: string, unit = "1") =>
  snak(property, "quantity", { amount, unit });

describe("snakValue", () => {
  it.each<[Snak, string]>([
    [item("P31", "Q5"), "Q5"],
    [snak("P1476", "string", 'say "hi"'), '"say \\"hi\\""'],
    [
      snak("P1705", "monolingualtext", { text: "Wien", language: "de" }),
      'de:"Wien"',
    ],
    [
      snak("P569", "time", {
        time: "+1952-03-11T00:00:00Z",
        precision: 11,
        calendarmodel: "http://www.wikidata.org/entity/Q1985727",
      }),
      "+1952-03-11T00:00:00Z/11",
    ],
    [
      snak("P571", "time", {
        time: "+1500-00-00T00:00:00Z",
        precision: 7,
        calendarmodel: "http://www.wikidata.org/entity/Q1985786",
      }),
      "+1500-00-00T00:00:00Z/7/J",
    ],
    [quantity("P1082", "+1505005"), "+1505005"],
    [
      quantity("P2046", "+104.91", "http://www.wikidata.org/entity/Q712226"),
      "+104.91U712226",
    ],
    [
      snak("P625", "globecoordinate", { latitude: 47.27, longitude: 11.39 }),
      "@47.27/11.39",
    ],
    // unknown datavalue types are passed on as quoted JSON
    [snak("P1", "geo-shape-x", { a: 1 }), '"{\\"a\\":1}"'],
    [{ snaktype: "somevalue", property: "P50" }, "somevalue"],
    [{ snaktype: "novalue", property: "P40" }, "novalue"],
  ])("formats %#", (s, expected) => {
    expect(snakValue(s)).toBe(expected);
  });
});

describe("toQuickStatements", () => {
  const Q = "Q1726";

  it("exports terms and sitelinks", () => {
    const edits: Edit[] = [
      { type: "label", language: "de", value: "München" },
      { type: "description", language: "en", value: "" },
      { type: "alias", language: "en", value: "Munich", remove: true },
      { type: "sitelink", site: "dewiki", title: "München" },
    ];
    expect(toQuickStatements(Q, edits).split("\n")).toEqual([
      'Q1726|Lde|"München"',
      'Q1726|Den|""',
      '-Q1726|Aen|"Munich"',
      'Q1726|Sdewiki|"München"',
    ]);
  });

  it("adds a statement with rank, qualifiers and one line per reference", () => {
    const edit: Edit = {
      type: "statement",
      claimId: "new-1",
      snak: quantity("P1082", "+1512491"),
      rank: "preferred",
      qualifiers: [item("P459", "Q52679562")],
      references: [[item("P248", "Q1")], [snak("P854", "string", "https://x")]],
    };
    expect(toQuickStatements(Q, [edit]).split("\n")).toEqual([
      "Q1726|P1082|+1512491|R+|P459|Q52679562|S248|Q1",
      'Q1726|P1082|+1512491|R+|P459|Q52679562|S854|"https://x"',
    ]);
  });

  it("removes existing statements by ID, pending ones by value", () => {
    expect(
      toQuickStatements(Q, [
        {
          type: "statement",
          claimId: "Q1726$ABC",
          remove: true,
          snak: item("P31", "Q515"),
        },
        {
          type: "statement",
          claimId: "new-2",
          remove: true,
          snak: item("P31", "Q1549591"),
        },
      ]),
    ).toBe("-STATEMENT|Q1726$ABC\n-Q1726|P31|Q1549591");
  });

  describe("changed statements", () => {
    const original = {
      snak: quantity("P1082", "+1505005"),
      qualifiers: [
        quantity("P1540", "+737442"),
        item("P459", "Q52679562"),
        item("P459", "Q52679562"),
      ],
    };
    const change = (s: Snak, qualifiers: Snak[]): Edit => ({
      type: "statement",
      claimId: "Q1726$X",
      snak: s,
      qualifiers,
      // rank and references are kept on the matched statement
      rank: "preferred",
      references: [[item("P248", "Q1")]],
      original,
    });

    it("switches the main value, keeping the statement", () => {
      expect(
        toQuickStatements(Q, [
          change(quantity("P1082", "+1505006"), original.qualifiers),
        ]),
      ).toBe("SWITCH_VALUE|Q1726|P1082|+1505005|+1505006");
    });

    it("removes and adds only the changed qualifiers", () => {
      expect(
        toQuickStatements(Q, [
          change(original.snak, [
            quantity("P1540", "+1999"),
            item("P459", "Q52679562"),
            item("P459", "Q52679562"),
            quantity("P2899", "+18"),
          ]),
        ]).split("\n"),
      ).toEqual([
        "REMOVE_QUAL|Q1726|P1082|+1505005|P1540|+737442",
        "Q1726|P1082|+1505005|P1540|+1999|P2899|+18",
      ]);
    });

    it("treats repeated qualifier values as a multiset", () => {
      expect(
        toQuickStatements(Q, [
          change(original.snak, [
            quantity("P1540", "+737442"),
            item("P459", "Q52679562"),
          ]),
        ]),
      ).toBe("REMOVE_QUAL|Q1726|P1082|+1505005|P459|Q52679562");
    });

    it("addresses qualifiers by the new value after a switch", () => {
      expect(
        toQuickStatements(Q, [change(quantity("P1082", "+1"), [])]).split("\n"),
      ).toEqual([
        "SWITCH_VALUE|Q1726|P1082|+1505005|+1",
        "REMOVE_QUAL|Q1726|P1082|+1|P1540|+737442",
        "REMOVE_QUAL|Q1726|P1082|+1|P459|Q52679562",
        "REMOVE_QUAL|Q1726|P1082|+1|P459|Q52679562",
      ]);
    });
  });
});
