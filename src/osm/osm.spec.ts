import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  changesetXml,
  geometryChanged,
  isClosed,
  osmChangeXml,
  saveTags,
  type OsmElement,
} from "./osm";

const way: OsmElement = {
  type: "way",
  id: 7,
  version: 3,
  timestamp: "2026-01-01T00:00:00Z",
  changeset: 1,
  nodes: [1, 2, 3, 1],
  tags: { building: "yes" },
};

describe("isClosed", () => {
  it("detects closed ways", () => {
    expect(isClosed(way)).toBe(true);
    expect(isClosed({ nodes: [1, 2, 3] })).toBe(false);
  });
});

describe("XML", () => {
  it("escapes changeset tags", () => {
    expect(changesetXml({ comment: 'Café "A" & <B>' })).toBe(
      '<osm><changeset><tag k="comment" v="Café &quot;A&quot; &amp; &lt;B&gt;"/></changeset></osm>',
    );
  });

  it("keeps geometry and version of the element", () => {
    expect(osmChangeXml(way, { building: "house" }, 99)).toBe(
      '<osmChange version="0.6" generator="DinoData"><modify><way id="7" version="3" changeset="99"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="house"/></way></modify></osmChange>',
    );
    expect(
      osmChangeXml(
        { ...way, type: "node", nodes: undefined, lat: 47.1, lon: 11.2 },
        {},
        1,
      ),
    ).toContain(
      '<node id="7" version="3" changeset="1" lat="47.1" lon="11.2">',
    );
    expect(
      osmChangeXml(
        {
          ...way,
          type: "relation",
          nodes: undefined,
          members: [{ type: "way", ref: 5, role: "outer" }],
        },
        {},
        1,
      ),
    ).toContain('<member type="way" ref="5" role="outer"/>');
  });
});

describe("saveTags", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates, uploads and closes a changeset", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer token",
      );
      if (url.endsWith("/changeset/create")) return new Response("42");
      if (url.endsWith("/upload"))
        return new Response(
          '<diffResult><way old_id="7" new_id="7" new_version="4"/></diffResult>',
        );
      return new Response("");
    });
    vi.stubGlobal("fetch", fetch);
    expect(
      await saveTags(way, { building: "house" }, { comment: "x" }, "token"),
    ).toEqual({ changeset: 42, version: 4 });
    expect(fetch.mock.calls.map(([url, init]) => [init?.method, url])).toEqual([
      ["PUT", "https://api.openstreetmap.org/api/0.6/changeset/create"],
      ["POST", "https://api.openstreetmap.org/api/0.6/changeset/42/upload"],
      ["PUT", "https://api.openstreetmap.org/api/0.6/changeset/42/close"],
    ]);
  });

  it("closes the changeset on conflicts", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/changeset/create")) return new Response("42");
      if (url.endsWith("/upload"))
        return new Response("Version mismatch", { status: 409 });
      return new Response("");
    });
    vi.stubGlobal("fetch", fetch);
    await expect(saveTags(way, {}, {}, "token")).rejects.toMatchObject({
      status: 409,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("geometryChanged", () => {
  it("compares nodes, not tags", () => {
    expect(geometryChanged(way, { ...way, tags: {} })).toBe(false);
    expect(geometryChanged(way, { ...way, nodes: [1, 2, 4, 1] })).toBe(true);
  });
});
