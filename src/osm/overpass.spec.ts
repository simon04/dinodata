import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  OVERPASS_URLS,
  OverpassUnavailableError,
  geometryDistance,
  queryFeatures,
  queryRadius,
  segmentDistance,
} from "./overpass";

const p = { lat: 47, lon: 11 };

describe("segmentDistance", () => {
  it("measures to the nearest point of the segment", () => {
    // 0.001° latitude ≈ 111 m
    const d = segmentDistance(
      p,
      { lat: 47.001, lon: 10.99 },
      { lat: 47.001, lon: 11.01 },
    );
    expect(d).toBeCloseTo(111.2, 0);
    // beyond the end: distance to the end point
    expect(
      segmentDistance(p, { lat: 47.001, lon: 11 }, { lat: 47.002, lon: 11 }),
    ).toBeCloseTo(111.2, 0);
  });
});

describe("geometryDistance", () => {
  it("handles points and lines", () => {
    expect(geometryDistance(p, [[p]])).toBe(0);
    expect(
      geometryDistance(p, [
        [{ lat: 47.01, lon: 11 }],
        [
          { lat: 47.001, lon: 10.99 },
          { lat: 47.001, lon: 11.01 },
        ],
      ]),
    ).toBeCloseTo(111.2, 0);
  });
});

describe("queryRadius", () => {
  it("grows when zooming out, like osm.org", () => {
    expect(queryRadius(19)).toBe(10);
    expect(queryRadius(18)).toBe(15);
  });
});

describe("queryFeatures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sorts nearby by distance and enclosing by size", async () => {
    const responses = [
      {
        elements: [
          { type: "node", id: 1, tags: { created_by: "x" }, lat: 47, lon: 11 },
          {
            type: "way",
            id: 2,
            tags: { highway: "path" },
            nodes: [5, 6],
            geometry: [
              { lat: 47.001, lon: 10.99 },
              null,
              { lat: 47.0001, lon: 11 },
              { lat: 47.0001, lon: 11.01 },
            ],
          },
          {
            type: "node",
            id: 3,
            tags: { amenity: "bench" },
            lat: 47.0005,
            lon: 11,
          },
        ],
      },
      {
        elements: [
          {
            type: "relation",
            id: 8,
            tags: { boundary: "administrative" },
            bounds: { minlat: 46, minlon: 10, maxlat: 48, maxlon: 12 },
          },
          {
            type: "way",
            id: 9,
            tags: { building: "yes" },
            bounds: {
              minlat: 46.99,
              minlon: 10.99,
              maxlat: 47.01,
              maxlon: 11.01,
            },
          },
        ],
      },
    ];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const query = (init.body as URLSearchParams).get("data")!;
      const json = responses[query.includes("is_in") ? 1 : 0];
      return new Response(JSON.stringify(json));
    });
    vi.stubGlobal("fetch", fetch);
    const { nearby, enclosing } = await queryFeatures(p, 18);
    expect(nearby.map((e) => e.id)).toEqual([2, 3]);
    expect(nearby[0].geometry).toHaveLength(2);
    expect(nearby[0].nodes).toEqual([5, 6]);
    expect(nearby[0].distance).toBeCloseTo(11.1, 0);
    expect(enclosing.map((e) => e.id)).toEqual([9, 8]);
    expect(
      (fetch.mock.calls[0][1].body as URLSearchParams).get("data"),
    ).toContain("around:15.0,47,11");
  });

  it("falls back to the next instance and keeps the working one", async () => {
    const empty = () => new Response(JSON.stringify({ elements: [] }));
    const fetch = vi.fn(async (url: string) => {
      if (url === OVERPASS_URLS[0]) throw new TypeError("Failed to fetch");
      return empty();
    });
    vi.stubGlobal("fetch", fetch);
    await queryFeatures(p, 18);
    const urls = () => fetch.mock.calls.map(([url]) => url);
    expect(urls()).toEqual([
      OVERPASS_URLS[0],
      OVERPASS_URLS[0],
      OVERPASS_URLS[1],
      OVERPASS_URLS[1],
    ]);
    fetch.mockClear();
    await queryFeatures(p, 18);
    expect(urls()).toEqual([OVERPASS_URLS[1], OVERPASS_URLS[1]]);
  });

  it("lists the instances without an API key only", () => {
    expect(OVERPASS_URLS).toEqual([
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ]);
  });

  it("reports all instances failing as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 502 })),
    );
    const error = await queryFeatures(p, 18).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OverpassUnavailableError);
    expect((error as OverpassUnavailableError).errors).toHaveLength(
      OVERPASS_URLS.length,
    );
  });
});
