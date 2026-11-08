import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { reversePlace } from "./geocoding";

afterEach(() => vi.unstubAllGlobals());

describe("reversePlace", () => {
  it("returns the object at the location, with its bounds", async () => {
    const fetch = vi.fn(async (_url: URL) =>
      Response.json({
        osm_type: "way",
        osm_id: 160971729,
        lat: "47.2435316",
        lon: "11.2811715",
        category: "building",
        type: "yes",
        name: "",
        display_name: "22, Kristen, Omes, Axams, 6094, Österreich",
        boundingbox: ["47.2433959", "47.2436570", "11.2810590", "11.2812567"],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const place = await reversePlace(
      { lat: 47.243799, lon: 11.281291, zoom: 19 },
      "de",
    );
    expect(place).toMatchObject({
      type: "way",
      id: 160971729,
      name: "22",
      description: "Kristen, Omes, Axams, 6094, Österreich",
      key: "building",
      value: "yes",
      bounds: {
        minlat: 47.2433959,
        minlon: 11.281059,
        maxlat: 47.243657,
        maxlon: 11.2812567,
      },
    });
    const url = fetch.mock.calls[0][0];
    expect(url.pathname).toBe("/reverse");
    // Nominatim zooms up to 18
    expect(url.searchParams.get("zoom")).toBe("18");
    expect(url.searchParams.get("accept-language")).toBe("de");
  });

  it("returns undefined where Nominatim finds nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Unable to geocode" })),
    );
    expect(
      await reversePlace({ lat: 0, lon: -30, zoom: 18 }, "en"),
    ).toBeUndefined();
  });
});
