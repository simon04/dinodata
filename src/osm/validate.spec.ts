import { describe, expect, it } from "vite-plus/test";
import type { TagDoc } from "./osmwiki";
import { validate } from "./validate";

const doc = (patch: Partial<TagDoc>): TagDoc => ({
  item: "Q1",
  page: "",
  discouraged: false,
  appliesTo: {},
  replacedBy: [],
  implies: [],
  combination: [],
  incompatible: [],
  requires: [],
  ...patch,
});
const node = { type: "node" as const };

describe("validate", () => {
  it("upgrades deprecated tags of the schema", () => {
    const issues = validate(node, { amenity: "shop" }, {}, {}, [
      { old: { amenity: "shop" }, replace: { shop: "*" } },
    ]);
    expect(issues).toEqual([
      {
        severity: "warning",
        key: "amenity",
        message: "osm-issue-deprecated",
        params: ["amenity=shop", "shop"],
        fix: { amenity: undefined, shop: "yes" },
      },
    ]);
  });

  it("replaces tags discouraged on the wiki", () => {
    const docs = {
      "highway=ford": doc({
        discouraged: true,
        status: "Q5061",
        replacedBy: ["Q2"],
      }),
      color: doc({ discouraged: true, status: "Q5061", replacedBy: ["Q3"] }),
    };
    const labels = { Q5061: "deprecated", Q2: "ford=yes", Q3: "colour" };
    const issues = validate(
      node,
      { highway: "ford", color: "red" },
      docs,
      labels,
      [],
    );
    expect(issues.map((i) => [i.message, i.fix])).toEqual([
      ["osm-issue-discouraged-replace", { highway: undefined, ford: "yes" }],
      ["osm-issue-discouraged-replace", { color: undefined, colour: "red" }],
    ]);
  });

  it("checks values against the wiki's regex", () => {
    const docs = { ele: doc({ regex: "-?\\d+(\\.\\d+)?" }) };
    expect(validate(node, { ele: "2717" }, docs, {}, [])).toEqual([]);
    expect(validate(node, { ele: "2717 m" }, docs, {}, [])[0]).toMatchObject({
      message: "osm-issue-format",
    });
  });

  it("reports tags not meant for the element type", () => {
    const docs = { building: doc({ appliesTo: { node: false, area: true } }) };
    expect(validate(node, { building: "yes" }, docs, {}, [])[0]).toMatchObject({
      message: "osm-issue-type-node",
      params: ["building"],
    });
    const closed = { type: "way" as const, nodes: [1, 2, 3, 1] };
    const docsWay = {
      building: doc({ appliesTo: { way: false, area: true } }),
    };
    expect(validate(closed, { building: "yes" }, docsWay, {}, [])).toEqual([]);
  });

  it("reports incompatible tags once", () => {
    const docs = {
      "access=no": doc({ incompatible: ["Q9"] }),
      "access=private": doc({}),
    };
    const issues = validate(
      node,
      { access: "no", "access:conditional": "yes" },
      docs,
      { Q9: "access:conditional" },
      [],
    );
    expect(issues.map((i) => i.message)).toEqual(["osm-issue-incompatible"]);
  });
});
