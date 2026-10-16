import { describe, expect, it } from "vite-plus/test";
import { claimToEdit, parseEntityJson, parseStatements } from "./clipboard";
import { toQuickStatements } from "./quickstatements";
import type { Claim } from "./wikidata";

const properties = {
  P31: { datatype: "wikibase-item" },
  P569: { datatype: "time" },
  P1082: { datatype: "quantity" },
  P585: { datatype: "time" },
  P248: { datatype: "wikibase-item" },
  P854: { datatype: "url" },
  P1476: { datatype: "monolingualtext" },
  P214: { datatype: "external-id" },
};
const parse = (text: string) => parseStatements(text, properties, "en");

describe("parseStatements", () => {
  it("ignores text that is neither QuickStatements nor P=value", () => {
    expect(parse("hello\nworld")).toBeUndefined();
  });

  it("parses P=value lines against the property datatype", () => {
    const result = parse("P31=Q5\np569 = 1952-03-11");
    expect(result?.invalid).toEqual([]);
    expect(result?.claims.map((c) => c.mainsnak.datavalue?.value)).toEqual([
      { "entity-type": "item", id: "Q5" },
      expect.objectContaining({ time: "+1952-03-11T00:00:00Z", precision: 11 }),
    ]);
  });

  it("replaces the subject and parses rank, qualifiers and references", () => {
    const [claim] = parse(
      'Q42|P1082|42U11573|R-|P585|+2020-00-00T00:00:00Z/9|S854|"https://example.org"',
    )!.claims;
    expect(claim.rank).toBe("deprecated");
    expect(Object.keys(claim.qualifiers!)).toEqual(["P585"]);
    expect(claim.references?.[0].snaks.P854[0].datavalue?.value).toBe(
      "https://example.org",
    );
  });

  it("merges a statement repeated with different references", () => {
    const result = parse(
      [
        "Q1|P31|Q5|S248|Q36578",
        "Q1|P31|Q5|S248|Q423048",
        "LAST|P31|Q5|P585|2001",
      ].join("\n"),
    )!;
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].references).toHaveLength(2);
  });

  it("parses terms and sitelinks, several aliases on one line", () => {
    expect(
      parse('Q1|Lde|"Wien"\nQ1|Aen|"Vienna"|"Wien"\nQ1|Sdewiki|"Wien"')!.terms,
    ).toEqual([
      { type: "label", language: "de", value: "Wien" },
      { type: "alias", language: "en", value: "Vienna" },
      { type: "alias", language: "en", value: "Wien" },
      { type: "sitelink", site: "dewiki", title: "Wien" },
    ]);
  });

  it("keeps quoted pipes inside values", () => {
    const [claim] = parse('Q1|P214|"a|b"')!.claims;
    expect(claim.mainsnak.datavalue?.value).toBe("a|b");
  });

  it("reports invalid lines with a hint", () => {
    const result = parse(
      [
        "P31=Q5",
        "P1082=many",
        "P9999=1",
        "-Q1|P31|Q5",
        "Q1|P31|Q5|P585",
        "Q1|Lde|Wien",
      ].join("\n"),
    )!;
    expect(result.claims).toHaveLength(1);
    expect(result.invalid).toEqual([
      "P1082=many (P1082=42)",
      "P9999=1 (P9999?)",
      expect.stringMatching(/^-Q1\|P31\|Q5 \(/),
      "Q1|P31|Q5|P585",
      'Q1|Lde|Wien ("…")',
    ]);
  });

  it("accepts somevalue and novalue", () => {
    const claims = parse("P31=somevalue\nP569=novalue")!.claims;
    expect(claims.map((c) => c.mainsnak.snaktype)).toEqual([
      "somevalue",
      "novalue",
    ]);
  });

  it("round-trips copied statements", () => {
    const claims: Claim[] = parse(
      [
        "Q1|P1082|+1505005|R+|P585|+2024-12-31T00:00:00Z/11|S248|Q1",
        'Q1|P1476|de:"Ein \\"Titel\\""',
      ].join("\n"),
    )!.claims;
    const text = toQuickStatements(
      "Q2",
      claims.map((c) => claimToEdit(c, "")),
    );
    expect(parse(text)!.claims).toEqual(claims);
  });
});

describe("parseEntityJson", () => {
  const claim = {
    mainsnak: { snaktype: "value", property: "P31" },
    rank: "normal",
  };

  it("reads Special:EntityData and plain entity JSON", () => {
    expect(
      parseEntityJson(
        JSON.stringify({ entities: { Q1: { claims: { P31: [claim] } } } }),
      ),
    ).toEqual([claim]);
    expect(
      parseEntityJson(JSON.stringify({ claims: { P31: [claim] } })),
    ).toEqual([claim]);
  });

  it("ignores other JSON and non-JSON", () => {
    expect(parseEntityJson('{"foo": 1}')).toBeUndefined();
    expect(parseEntityJson("P31=Q5")).toBeUndefined();
  });
});

describe("claimToEdit", () => {
  it("flattens qualifiers and references", () => {
    const edit = claimToEdit(
      {
        id: "Q1$1",
        rank: "preferred",
        mainsnak: { snaktype: "novalue", property: "P40" },
        qualifiers: {
          P585: [{ snaktype: "somevalue", property: "P585" }],
        },
        references: [
          { snaks: { P248: [{ snaktype: "somevalue", property: "P248" }] } },
        ],
      },
      "x",
    );
    expect(edit).toMatchObject({
      claimId: "x",
      rank: "preferred",
      qualifiers: [{ property: "P585" }],
      references: [[{ property: "P248" }]],
    });
  });
});
