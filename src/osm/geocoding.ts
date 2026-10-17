import { osmTypeFromLetter, type OsmRef, type OsmType } from "./osm-ref";

/**
 * Place search with Nominatim (on submit only: its usage policy forbids
 * autocomplete) and Photon (OSM-based as well, allows search-as-you-type).
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const PHOTON = "https://photon.komoot.io/api/";
/** languages Photon has names for, others get the local name */
const PHOTON_LANGUAGES = new Set(["de", "en", "fr"]);

export interface Place extends OsmRef {
  name: string;
  /** address or context, e.g. "Innsbruck, Austria" */
  description?: string;
  /** main tag, e.g. amenity=restaurant */
  key?: string;
  value?: string;
  lat?: number;
  lon?: number;
}

export interface Bounds {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

interface NominatimResult {
  osm_type: OsmType;
  osm_id: number;
  name?: string;
  display_name: string;
  category: string;
  type: string;
  lat: string;
  lon: string;
  /** minlat, maxlat, minlon, maxlon */
  boundingbox: [string, string, string, string];
}

async function nominatim(
  path: string,
  params: Record<string, string>,
): Promise<NominatimResult[]> {
  const url = new URL(`${NOMINATIM}/${path}`);
  url.search = new URLSearchParams({ format: "jsonv2", ...params }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function toPlace(r: NominatimResult): Place {
  const name = r.name || r.display_name.split(",")[0];
  return {
    type: r.osm_type,
    id: r.osm_id,
    name,
    description: r.display_name.startsWith(name)
      ? r.display_name.slice(name.length).replace(/^,\s*/, "")
      : r.display_name,
    key: r.category,
    value: r.type,
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

/** Nominatim search, on explicit submit. */
export async function searchPlaces(
  query: string,
  language: string,
): Promise<Place[]> {
  const results = await nominatim("search", {
    q: query,
    limit: "20",
    "accept-language": language,
  });
  return results.filter((r) => r.osm_type && r.osm_id).map(toPlace);
}

/** Bounding box of an element via Nominatim (only for indexed objects). */
export async function lookupBounds(ref: OsmRef): Promise<Bounds | undefined> {
  const [r] = await nominatim("lookup", {
    osm_ids: `${ref.type[0].toUpperCase()}${ref.id}`,
  });
  if (!r) return undefined;
  const [minlat, maxlat, minlon, maxlon] = r.boundingbox.map(Number);
  return { minlat, minlon, maxlat, maxlon };
}

interface PhotonFeature {
  properties: {
    osm_type: string;
    osm_id: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    country?: string;
  };
  geometry: { coordinates: [number, number] };
}

/** Photon search, for suggestions while typing. */
export async function suggestPlaces(
  query: string,
  language: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url = new URL(PHOTON);
  url.search = new URLSearchParams({
    q: query,
    limit: "8",
    ...(PHOTON_LANGUAGES.has(language) && { lang: language }),
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.flatMap(({ properties: p, geometry }) => {
    const type = osmTypeFromLetter(p.osm_type);
    if (!type) return [];
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const name = p.name ?? street;
    if (!name) return [];
    return [
      {
        type,
        id: p.osm_id,
        name,
        description: [p.name ? street : "", p.city, p.country]
          .filter(Boolean)
          .join(", "),
        key: p.osm_key,
        value: p.osm_value,
        lat: geometry.coordinates[1],
        lon: geometry.coordinates[0],
      },
    ];
  });
}
