import { parseOsmRef, type OsmRef } from "./osm/osm-ref";

/**
 * Hash routes: Wikidata mode (`#Q40`) and OpenStreetMap mode (`#osm`,
 * `#osm/way/123`, `#osm/search/…`).
 */
export type Route =
  | { mode: "wikidata"; id?: string }
  | { mode: "osm"; ref?: OsmRef; search?: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "osm" || path.startsWith("osm/")) {
    const search = path.match(/^osm\/search\/(.+)$/)?.[1];
    if (search) return { mode: "osm", search: decodeURIComponent(search) };
    return { mode: "osm", ref: parseOsmRef(path) };
  }
  return { mode: "wikidata", id: path.match(/^([LPQ]\d+)$/)?.[1] };
}
