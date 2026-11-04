import { describe, expect, it } from "vite-plus/test";
import { formatLevel0 } from "./level0";
import type { OsmElement } from "./osm";
import { parseTagText } from "./tags";

const meta = { version: 3, timestamp: "", changeset: 1 };

describe("formatLevel0", () => {
  it("formats a node with coordinates and sorted, escaped tags", () => {
    const node: OsmElement = {
      type: "node",
      id: 1,
      lat: 47.1,
      lon: 11.2,
      ...meta,
    };
    expect(formatLevel0(node, { name: "A", amenity: "cafe", "a=b": "c" })).toBe(
      "node 1: 47.1, 11.2\n  a\\=b = c\n  amenity = cafe\n  name = A",
    );
  });

  it("formats way nodes and relation members", () => {
    const way: OsmElement = { type: "way", id: 2, nodes: [5, 6], ...meta };
    expect(formatLevel0(way, { highway: "service" })).toBe(
      "way 2\n  highway = service\n  nd 5\n  nd 6",
    );
    const relation: OsmElement = {
      type: "relation",
      id: 3,
      members: [
        { type: "way", ref: 2, role: "outer" },
        { type: "node", ref: 5, role: "" },
        { type: "relation", ref: 4, role: "subarea" },
      ],
      ...meta,
    };
    expect(formatLevel0(relation, {})).toBe(
      "relation 3\n  wy 2 outer\n  nd 5\n  rel 4 subarea",
    );
  });

  it("round-trips through parseTagText", () => {
    const way: OsmElement = { type: "way", id: 2, nodes: [5, 6], ...meta };
    const tags = { highway: "service", "a=b": "x = y" };
    expect(parseTagText(formatLevel0(way, tags), way)).toEqual({
      tags,
      invalid: [],
      object: { type: "way", id: 2, nodes: [5, 6], members: [] },
      ignored: [],
    });
  });
});
