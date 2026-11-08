import {
  parseMapView,
  parseOsmRef,
  type MapView,
  type OsmRef,
} from "./osm/osm-ref";

/**
 * Hash routes: Wikidata mode (`#Q40`, compared with another item
 * `#Q40?compare=Q41`) and OpenStreetMap mode (`#osm`, `#osm/way/123`,
 * `#osm/search/…`, query features at `#osm/map=zoom/lat/lon`).
 */
export type Route =
  | { mode: "wikidata"; id?: string; compare?: string }
  | { mode: "osm"; ref?: OsmRef; search?: string; map?: MapView };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "osm" || path.startsWith("osm/")) {
    const search = path.match(/^osm\/search\/(.+)$/)?.[1];
    if (search) return { mode: "osm", search: decodeURIComponent(search) };
    if (path.startsWith("osm/map=")) {
      const map = parseMapView(path.slice(4));
      if (map) return { mode: "osm", map };
    }
    return { mode: "osm", ref: parseOsmRef(path) };
  }
  const [entity, query = ""] = path.split("?", 2);
  const compare = new URLSearchParams(query)
    .get("compare")
    ?.match(/^[LMPQ]\d+$/)?.[0];
  return {
    mode: "wikidata",
    id: entity.match(/^([LMPQ]\d+)$/)?.[1],
    ...(compare && { compare }),
  };
}

/** Hash of an entity, optionally compared with another one. */
export function entityHash(id: string, compare?: string): string {
  return compare ? `#${id}?compare=${compare}` : `#${id}`;
}
