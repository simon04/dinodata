import { lookupBounds, type Bounds } from "./geocoding";
import type { LatLon, OsmRef, OsmType } from "./osm-ref";

/**
 * OpenStreetMap API 0.6 (CORS enabled). The website and API URL can be
 * switched to the dev server (`master.apis.dev.openstreetmap.org`) via
 * `VITE_OSM_URL`, e.g. for testing uploads.
 */
export const OSM_URL = (
  import.meta.env.VITE_OSM_URL || "https://www.openstreetmap.org"
).replace(/\/$/, "");
export const OSM_API =
  OSM_URL === "https://www.openstreetmap.org"
    ? "https://api.openstreetmap.org/api/0.6"
    : `${OSM_URL}/api/0.6`;

export type Tags = Record<string, string>;

export interface OsmMember {
  type: OsmType;
  ref: number;
  role: string;
}

export interface OsmElement {
  type: OsmType;
  id: number;
  version: number;
  timestamp: string;
  changeset: number;
  user?: string;
  uid?: number;
  tags?: Tags;
  /** nodes only */
  lat?: number;
  lon?: number;
  /** ways only */
  nodes?: number[];
  /** relations only */
  members?: OsmMember[];
}

/** Error from the OSM API, e.g. 409 (version conflict) or 410 (deleted). */
export class OsmApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OsmApiError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${OSM_API}${path}`, init);
  if (!res.ok)
    throw new OsmApiError(
      res.status,
      (await res.text().catch(() => "")) || `${res.status} ${res.statusText}`,
    );
  return res;
}

/** The current version of an element, never cached (editing needs the version). */
export async function getElement({ type, id }: OsmRef): Promise<OsmElement> {
  const res = await request(`/${type}/${id}.json`, { cache: "no-store" });
  const json = (await res.json()) as { elements: OsmElement[] };
  return json.elements[0];
}

/** Ways (of a node) and relations an element is part of. */
export async function getParents({ type, id }: OsmRef): Promise<OsmElement[]> {
  const paths = [
    ...(type === "node" ? [`/node/${id}/ways.json`] : []),
    `/${type}/${id}/relations.json`,
  ];
  const results = await Promise.all(
    paths.map(async (path) => {
      const res = await request(path);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    }),
  );
  return results.flat();
}

/** Website URL of an element. */
export function elementUrl({ type, id }: OsmRef): string {
  return `${OSM_URL}/${type}/${id}`;
}

/** iD editor for the element. */
export function editUrl({ type, id }: OsmRef): string {
  return `${OSM_URL}/edit?editor=id&${type}=${id}`;
}

/** Closed way: first and last node are the same. */
export function isClosed(element: Pick<OsmElement, "nodes">): boolean {
  const nodes = element.nodes ?? [];
  return nodes.length > 3 && nodes[0] === nodes[nodes.length - 1];
}

/** Node coordinates, undefined for ways and relations (see `getBounds`). */
export function nodeLocation(element: OsmElement): LatLon | undefined {
  return element.lat !== undefined && element.lon !== undefined
    ? { lat: element.lat, lon: element.lon }
    : undefined;
}

/** Bounding box: node location, way nodes, or Nominatim for relations. */
export async function getBounds(
  element: OsmElement,
): Promise<Bounds | undefined> {
  const node = nodeLocation(element);
  if (node)
    return {
      minlat: node.lat,
      minlon: node.lon,
      maxlat: node.lat,
      maxlon: node.lon,
    };
  if (element.type === "way") {
    const res = await request(`/way/${element.id}/full.json`);
    const { elements } = (await res.json()) as { elements: OsmElement[] };
    return boundsOf(elements.flatMap((e) => nodeLocation(e) ?? []));
  }
  // relations may be huge (e.g. countries): not fetched in full
  return lookupBounds(element);
}

export function boundsOf(points: LatLon[]): Bounds | undefined {
  if (!points.length) return undefined;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    minlat: Math.min(...lats),
    minlon: Math.min(...lons),
    maxlat: Math.max(...lats),
    maxlon: Math.max(...lons),
  };
}
