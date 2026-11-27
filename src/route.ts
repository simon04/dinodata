import {
  parseMapView,
  parseOsmRef,
  type MapView,
  type OsmRef,
} from "./osm/osm-ref";

/**
 * Hash routes: Wikidata mode (`#Q40`, compared with another item
 * `#Q40?compare=Q41`, looked up by a statement value `#P954=8100002`, or
 * the edits of a user `#contributions/Name`)
 * and OpenStreetMap mode (`#osm`, `#osm/way/123`, `#osm/search/…`, query
 * features at `#osm/map=zoom/lat/lon`).
 */
export type Route =
  | {
      mode: "wikidata";
      id?: string;
      compare?: string;
      /** item(s) with a statement `property = value`, e.g. P954 (IBNR) = 8100002 */
      lookup?: { property: string; value: string };
      /** user name or IP whose edits are listed */
      contributions?: string;
    }
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
  const contributions = path.match(/^contributions\/(.+)$/)?.[1];
  if (contributions)
    return {
      mode: "wikidata",
      contributions: decodeURIComponent(contributions).replace(/_/g, " "),
    };
  const lookup = path.match(/^(P\d+)=(.+)$/);
  if (lookup)
    return {
      mode: "wikidata",
      lookup: { property: lookup[1], value: decodeURIComponent(lookup[2]) },
    };
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

/** Hash of a lookup by statement value, e.g. `#P1671=101%2001`. */
export function lookupHash(property: string, value: string): string {
  return `#${property}=${encodeURIComponent(value)}`;
}

/** Hash of the contributions of a user, e.g. `#contributions/Simon04`. */
export function contributionsHash(user: string): string {
  return `#contributions/${encodeURIComponent(user.replace(/ /g, "_"))}`;
}
