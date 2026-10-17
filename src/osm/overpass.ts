import type { OsmElement } from "./osm";
import type { LatLon } from "./osm-ref";

/**
 * Overpass API for objects near a location. The public instances are often
 * busy, so the next one is tried on failure.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export interface NearbyElement extends OsmElement {
  /** distance in meters */
  distance: number;
  /** center of ways and relations */
  center?: LatLon;
}

async function overpass(query: string): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Distance in meters (equirectangular approximation, fine for short ones). */
export function distance(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/** Tagged objects within `radius` meters, nearest first. */
export async function getNearby(
  location: LatLon,
  radius = 50,
): Promise<NearbyElement[]> {
  const { lat, lon } = location;
  const elements = await overpass(
    `[out:json][timeout:15];nwr(around:${radius},${lat},${lon})[~"."~"."];out tags center 100;`,
  );
  return elements
    .flatMap((e) => {
      // only uninteresting tags, e.g. nodes of a way with created_by
      const keys = Object.keys(e.tags ?? {});
      if (!keys.some((k) => !["created_by", "source"].includes(k))) return [];
      const center =
        (e as NearbyElement).center ??
        (e.lat !== undefined ? { lat: e.lat, lon: e.lon! } : undefined);
      return center
        ? [{ ...e, center, distance: distance(location, center) }]
        : [];
    })
    .sort((a, b) => a.distance - b.distance);
}
