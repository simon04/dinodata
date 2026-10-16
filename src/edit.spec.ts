import { describe, expect, it } from "vite-plus/test";
import { toEntityData } from "./edit";
import type { Entity, Snak } from "./wikidata";

const item = (property: string, id: string): Snak => ({
  snaktype: "value",
  property,
  datatype: "wikibase-item",
  datavalue: {
    type: "wikibase-entityid",
    value: { "entity-type": "item", id },
  },
});
const reference = { snaks: { P143: [item("P143", "Q328")] } };
const entity: Entity = {
  id: "Q42",
  lastrevid: 1,
  labels: {},
  descriptions: {},
  aliases: {},
  claims: {
    P31: [
      {
        id: "Q42$a",
        rank: "preferred",
        mainsnak: item("P31", "Q5"),
        qualifiers: { P642: [item("P642", "Q1")] },
        references: [reference],
      },
    ],
    P106: [
      { id: "Q42$b", rank: "normal", mainsnak: item("P106", "Q36180") },
      { id: "Q42$c", rank: "normal", mainsnak: item("P106", "Q36180") },
    ],
  },
};

describe("toEntityData", () => {
  it("sets and removes terms and sitelinks", () => {
    expect(
      toEntityData(entity, [
        { type: "label", language: "de", value: "Douglas Adams" },
        { type: "description", language: "en", value: "" },
        { type: "alias", language: "en", value: "DNA" },
        { type: "alias", language: "en", value: "D.A.", remove: true },
        { type: "sitelink", site: "dewiki", title: "Douglas Adams" },
        { type: "sitelink", site: "enwiki", title: "" },
      ]),
    ).toEqual({
      labels: { de: { language: "de", value: "Douglas Adams" } },
      descriptions: { en: { language: "en", value: "" } },
      aliases: [
        { language: "en", value: "DNA", add: "" },
        { language: "en", value: "D.A.", remove: "" },
      ],
      sitelinks: {
        dewiki: { site: "dewiki", title: "Douglas Adams" },
        enwiki: { site: "enwiki", title: "", remove: "" },
      },
    });
  });

  it("adds statements with rank, qualifiers and references", () => {
    expect(
      toEntityData(entity, [
        {
          type: "statement",
          claimId: "new-1",
          snak: item("P800", "Q3107329"),
          rank: "preferred",
          qualifiers: [item("P642", "Q2"), item("P642", "Q3")],
          references: [[item("P143", "Q328")]],
        },
      ]).claims,
    ).toEqual([
      {
        type: "statement",
        rank: "preferred",
        mainsnak: item("P800", "Q3107329"),
        qualifiers: { P642: [item("P642", "Q2"), item("P642", "Q3")] },
        references: [reference],
      },
    ]);
  });

  it("changes statements by ID, keeping rank and references", () => {
    expect(
      toEntityData(entity, [
        {
          type: "statement",
          claimId: "Q42$a",
          snak: item("P31", "Q15632617"),
          original: { snak: item("P31", "Q5"), qualifiers: [] },
        },
      ]).claims,
    ).toEqual([
      {
        id: "Q42$a",
        type: "statement",
        rank: "preferred",
        mainsnak: item("P31", "Q15632617"),
        references: [reference],
      },
    ]);
  });

  it("removes statements by ID, pasted ones by value", () => {
    expect(
      toEntityData(entity, [
        {
          type: "statement",
          claimId: "Q42$a",
          remove: true,
          snak: item("P31", "Q5"),
        },
        {
          type: "statement",
          claimId: "new-2",
          remove: true,
          snak: item("P106", "Q36180"),
        },
        // nothing to remove
        {
          type: "statement",
          claimId: "new-3",
          remove: true,
          snak: item("P106", "Q1"),
        },
      ]).claims,
    ).toEqual([
      { id: "Q42$a", remove: "" },
      { id: "Q42$b", remove: "" },
      { id: "Q42$c", remove: "" },
    ]);
  });

  it("fails for changed statements no longer on the item", () => {
    expect(() =>
      toEntityData(entity, [
        {
          type: "statement",
          claimId: "Q42$gone",
          snak: item("P31", "Q5"),
          original: { snak: item("P31", "Q5"), qualifiers: [] },
        },
      ]),
    ).toThrow("Q42$gone");
  });
});
