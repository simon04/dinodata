/**
 * References to OpenStreetMap objects: parsed from URLs, short forms and
 * coordinates typed or pasted by the user.
 */

export type OsmType = "node" | "way" | "relation";

export interface OsmRef {
  type: OsmType;
  id: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

const TYPES: Record<string, OsmType> = {
  n: "node",
  node: "node",
  w: "way",
  way: "way",
  r: "relation",
  rel: "relation",
  relation: "relation",
};

/**
 * Parse an OSM object reference:
 * - URLs of openstreetmap.org (`/way/123`, `/edit?way=123`, `/api/0.6/way/123`),
 *   also of other OSM websites with the same paths
 * - JOSM remote control (`load_object?objects=w123`)
 * - short forms: `w123`, `way 123`, `way/123`, `way:123`, `#osm/way/123`
 */
export function parseOsmRef(input: string): OsmRef | undefined {
  const text = input.trim();
  const short = text.match(
    /^(?:#?osm\/)?(n|w|r|node|way|rel|relation)\s*[/: ]?\s*(\d+)$/i,
  );
  if (short) return ref(short[1], short[2]);
  let url: URL;
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  if (!url.hostname.includes(".")) return undefined;
  // /way/123, /api/0.6/way/123.json, /way/123/history
  const path = url.pathname.match(/\/(node|way|relation)\/(\d+)(?:[/.]|$)/);
  if (path) return ref(path[1], path[2]);
  // /edit?way=123
  for (const type of ["node", "way", "relation"])
    if (/^\d+$/.test(url.searchParams.get(type) ?? ""))
      return ref(type, url.searchParams.get(type)!);
  // JOSM remote control: objects=w123 (only one object)
  const objects = url.searchParams.get("objects")?.split(",");
  if (objects?.length === 1) {
    const m = objects[0].match(/^([nwr])(\d+)$/);
    if (m) return ref(m[1], m[2]);
  }
  // iD: #id=w123
  const hashId = url.hash.match(/[#&]id=([nwr])(\d+)/);
  if (hashId) return ref(hashId[1], hashId[2]);
  return undefined;
}

function ref(type: string, id: string): OsmRef | undefined {
  const osmType = TYPES[type.toLowerCase()];
  const n = Number(id);
  return osmType && n > 0 ? { type: osmType, id: n } : undefined;
}

/** Parse `47.26, 11.39`, `geo:47.26,11.39` or a `#map=zoom/lat/lon` URL. */
export function parseLatLon(input: string): LatLon | undefined {
  const text = input.trim();
  const map = text.match(/[#&]map=\d+(?:\.\d+)?\/(-?[\d.]+)\/(-?[\d.]+)/);
  const plain = text.match(
    /^(?:geo:)?\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)(?:[;?].*)?$/,
  );
  const m = map ?? plain;
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
}

/** Short form used in UI chips, e.g. `w123`. */
export function shortRef({ type, id }: OsmRef): string {
  return `${type[0]}${id}`;
}

/** Hash route of the tag editor. */
export function osmHash({ type, id }: OsmRef): string {
  return `#osm/${type}/${id}`;
}

/** Nominatim and Photon type letters (`N`, `W`, `R`) → OSM type. */
export function osmTypeFromLetter(letter: string): OsmType | undefined {
  return TYPES[letter.toLowerCase()];
}
