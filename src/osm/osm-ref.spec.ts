import { describe, expect, it } from "vite-plus/test";
import { osmHash, parseLatLon, parseOsmRef, shortRef } from "./osm-ref";
import { parseRoute } from "../route";

describe("parseOsmRef", () => {
  it.each([
    ["https://www.openstreetmap.org/way/123", "way", 123],
    ["https://www.openstreetmap.org/node/1#map=19/47.26/11.39", "node", 1],
    ["openstreetmap.org/relation/42/history", "relation", 42],
    ["osm.org/way/7", "way", 7],
    ["https://www.openstreetmap.org/edit?way=123#map=19/47/11", "way", 123],
    ["https://api.openstreetmap.org/api/0.6/node/5.json", "node", 5],
    ["https://www.openstreetmap.org/edit#id=w99&map=19/47/11", "way", 99],
    ["http://127.0.0.1:8111/load_object?objects=r12", "relation", 12],
    ["w123", "way", 123],
    ["N5", "node", 5],
    ["way 123", "way", 123],
    ["relation/9", "relation", 9],
    ["rel:9", "relation", 9],
    ["osm/node/3", "node", 3],
  ])("%s", (input, type, id) => {
    expect(parseOsmRef(input)).toEqual({ type, id });
  });

  it.each(["Innsbruck", "w", "way 0", "https://example.org/", "123"])(
    "rejects %s",
    (input) => {
      expect(parseOsmRef(input)).toBeUndefined();
    },
  );
});

describe("parseLatLon", () => {
  it.each([
    ["47.26, 11.39", 47.26, 11.39],
    ["-33.9 151.2", -33.9, 151.2],
    ["geo:47.26,11.39", 47.26, 11.39],
    ["https://www.openstreetmap.org/#map=17/47.2692/11.4041", 47.2692, 11.4041],
  ])("%s", (input, lat, lon) => {
    expect(parseLatLon(input)).toEqual({ lat, lon });
  });

  it("rejects text and out of range values", () => {
    expect(parseLatLon("Innsbruck")).toBeUndefined();
    expect(parseLatLon("95, 11")).toBeUndefined();
  });
});

describe("shortRef and osmHash", () => {
  it("formats references", () => {
    expect(shortRef({ type: "way", id: 1 })).toBe("w1");
    expect(osmHash({ type: "relation", id: 2 })).toBe("#osm/relation/2");
  });
});

describe("parseRoute", () => {
  it("parses Wikidata routes", () => {
    expect(parseRoute("#Q40")).toEqual({ mode: "wikidata", id: "Q40" });
    expect(parseRoute("")).toEqual({ mode: "wikidata", id: undefined });
  });

  it("parses OSM routes", () => {
    expect(parseRoute("#osm")).toEqual({ mode: "osm", ref: undefined });
    expect(parseRoute("#osm/way/123")).toEqual({
      mode: "osm",
      ref: { type: "way", id: 123 },
    });
    expect(parseRoute("#osm/search/Innsbruck%20Markt")).toEqual({
      mode: "osm",
      search: "Innsbruck Markt",
    });
  });
});
