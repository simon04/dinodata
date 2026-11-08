import type { OsmElement } from "./osm";
import type { Bounds } from "./geocoding";
import type { LatLon } from "./osm-ref";

const env = import.meta.env;

/**
 * Overpass API instances for “Query features”, in place of
 * query.openstreetmap.org, which only serves osm.org. Tried in this order,
 * the first one answering is kept for the next queries. The ones with an API
 * key only if it is set (`VITE_OVERPASS_KEY_*`); it ends up in the bundle.
 */
export const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  key(
    env.VITE_OVERPASS_KEY_GEOFABRIK,
    (k) => `https://overpass.geofabrik.de/${k}/api/interpreter`,
  ),
  key(
    env.VITE_OVERPASS_KEY_FAIRWAYMAPPER,
    (k) => `https://api.fairwaymapper.com/k/${k}/api/interpreter`,
  ),
  key(
    env.VITE_OVERPASS_KEY_TRACESTRACK,
    (k) => `https://api.tracestrack.com/overpass/${k}/interpreter`,
  ),
  key(
    env.VITE_OVERPASS_KEY_OVERSPAN,
    (k) => `https://api.overspan.dev/${k}/api/interpreter`,
  ),
].filter((url) => url !== undefined);

function key(
  value: string | undefined,
  url: (key: string) => string,
): string | undefined {
  return value ? url(encodeURIComponent(value)) : undefined;
}

/** a busy instance may hang instead of failing, the queries say 10 s */
const TIMEOUT = 15_000;

/** index in OVERPASS_URLS of the instance that answered last */
let working = 0;

/** Tagged object near the query location, as in “Query features” of osm.org. */
export interface FeatureElement extends OsmElement {
  /** distance in meters to the nearest point of the geometry */
  distance: number;
  /** nodes: one point, ways and relation members: lines (clipped) */
  geometry: LatLon[][];
}

/** Way or relation enclosing the query location, smallest first. */
export interface EnclosingElement extends OsmElement {
  bounds?: Bounds;
}

/** Overpass JSON with `out geom` */
interface GeomElement extends Omit<OsmElement, "members"> {
  geometry?: (LatLon | null)[];
  bounds?: Bounds;
  members?: {
    type: OsmElement["type"];
    ref: number;
    role: string;
    lat?: number;
    lon?: number;
    geometry?: (LatLon | null)[];
  }[];
}

/** No Overpass instance answered: all busy, timed out or unreachable. */
export class OverpassUnavailableError extends Error {
  constructor(readonly errors: unknown[]) {
    super(`Overpass API unavailable: ${errors.map(String).join("; ")}`);
    this.name = "OverpassUnavailableError";
  }
}

async function overpass<T = OsmElement>(query: string): Promise<T[]> {
  const errors: unknown[] = [];
  // the working instance first, then the others in their order
  const start = working;
  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    const index = (start + i) % OVERPASS_URLS.length;
    try {
      const res = await fetch(OVERPASS_URLS[index], {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { elements } = (await res.json()) as { elements: T[] };
      working = index;
      return elements;
    } catch (e) {
      errors.push(e);
    }
  }
  throw new OverpassUnavailableError(errors);
}

/** Distance in meters (equirectangular approximation, fine for short ones). */
export function distance(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/** Distance in meters from `p` to the segment `a`–`b`. */
export function segmentDistance(p: LatLon, a: LatLon, b: LatLon): number {
  // local planar coordinates in meters around p
  const k = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lon - p.lon) * k;
  const ay = a.lat - p.lat;
  const bx = (b.lon - p.lon) * k;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.min(Math.max(-(ax * dx + ay * dy) / len, 0), 1) : 0;
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.sqrt(x * x + y * y) * ((Math.PI / 180) * 6371000);
}

/** Distance in meters from `p` to the nearest point of the lines. */
export function geometryDistance(p: LatLon, lines: LatLon[][]): number {
  let min = Infinity;
  for (const line of lines) {
    if (line.length === 1) min = Math.min(min, distance(p, line[0]));
    for (let i = 1; i < line.length; i++)
      min = Math.min(min, segmentDistance(p, line[i - 1], line[i]));
  }
  return min;
}

/** Split at the `null` gaps of clipped Overpass geometries. */
function lines(geometry: (LatLon | null)[] | undefined): LatLon[][] {
  const result: LatLon[][] = [[]];
  for (const point of geometry ?? [])
    if (point)
      result[result.length - 1].push({ lat: point.lat, lon: point.lon });
    else if (result[result.length - 1].length) result.push([]);
  return result.filter((line) => line.length);
}

function featureGeometry(e: GeomElement): LatLon[][] {
  if (e.lat !== undefined && e.lon !== undefined)
    return [[{ lat: e.lat, lon: e.lon }]];
  if (e.geometry) return lines(e.geometry);
  return (e.members ?? []).flatMap((m) =>
    m.lat !== undefined && m.lon !== undefined
      ? [[{ lat: m.lat, lon: m.lon }]]
      : lines(m.geometry),
  );
}

/** Only uninteresting tags, e.g. nodes of a way with `created_by`. */
function isTagged(e: { tags?: OsmElement["tags"] }): boolean {
  return Object.keys(e.tags ?? {}).some(
    (k) => !["created_by", "source"].includes(k),
  );
}

/**
 * Search radius in meters for a click at `zoom`, about 10 pixels like
 * “Query features” of openstreetmap.org.
 */
export function queryRadius(zoom: number): number {
  return 10 * 1.5 ** (19 - zoom);
}

/**
 * “Query features” of openstreetmap.org: tagged objects near the location
 * (nearest first) and the ways and relations enclosing it (smallest first).
 * Its own server (query.openstreetmap.org) only serves osm.org, so the same
 * queries go to the first working one of `OVERPASS_URLS`.
 */
export async function queryFeatures(
  location: LatLon,
  zoom: number,
): Promise<{ nearby: FeatureElement[]; enclosing: EnclosingElement[] }> {
  const { lat, lon } = location;
  const radius = queryRadius(zoom);
  // geometries clipped to a box around the location, like the map on osm.org
  const dLat = (radius * 20) / 111320;
  const dLon = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon]
    .map((n) => n.toFixed(6))
    .join(",");
  const around = `around:${radius.toFixed(1)},${lat},${lon}`;
  const [nearby, enclosing] = await Promise.all([
    overpass<GeomElement>(
      `[out:json][timeout:10];(node(${around});way(${around}););out geom(${bbox});relation(${around});out geom(${bbox});`,
    ),
    overpass<EnclosingElement>(
      `[out:json][timeout:10];is_in(${lat},${lon})->.a;way(pivot.a);out tags bb;relation(pivot.a);out tags bb;`,
    ),
  ]);
  const area = ({ bounds: b }: EnclosingElement) =>
    b ? (b.maxlat - b.minlat) * (b.maxlon - b.minlon) : Infinity;
  return {
    nearby: nearby
      .filter(isTagged)
      .map((e): FeatureElement => {
        const geometry = featureGeometry(e);
        // way nodes for the closed check of presets, no member geometries
        const { type, id, version, timestamp, changeset, tags, nodes } = e;
        return {
          type,
          id,
          version,
          timestamp,
          changeset,
          tags,
          nodes,
          geometry,
          distance: geometryDistance(location, geometry),
        };
      })
      .sort((a, b) => a.distance - b.distance),
    enclosing: enclosing.filter(isTagged).sort((a, b) => area(a) - area(b)),
  };
}
