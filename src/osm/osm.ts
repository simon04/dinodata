import { lookupBounds, type Bounds } from "./geocoding";
import { OSM_API, OSM_URL } from "./config";
import type { LatLon, OsmRef, OsmType } from "./osm-ref";

export { OSM_API, OSM_URL } from "./config";

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

const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );

const tagsXml = (tags: Tags) =>
  Object.entries(tags)
    .map(([k, v]) => `<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`)
    .join("");

/** `<osm><changeset>` with the changeset tags. */
export function changesetXml(tags: Tags): string {
  return `<osm><changeset>${tagsXml(tags)}</changeset></osm>`;
}

/**
 * osmChange modifying the element: unchanged geometry (coordinates, nodes,
 * members) and version, new tags.
 */
export function osmChangeXml(
  element: OsmElement,
  tags: Tags,
  changeset: number,
): string {
  const { type, id, version } = element;
  const attrs = [
    `id="${id}"`,
    `version="${version}"`,
    `changeset="${changeset}"`,
    ...(type === "node"
      ? [`lat="${element.lat}"`, `lon="${element.lon}"`]
      : []),
  ].join(" ");
  const children = [
    ...(element.nodes ?? []).map((ref) => `<nd ref="${ref}"/>`),
    ...(element.members ?? []).map(
      (m) =>
        `<member type="${m.type}" ref="${m.ref}" role="${escapeXml(m.role)}"/>`,
    ),
    tagsXml(tags),
  ].join("");
  return `<osmChange version="0.6" generator="DinoData"><modify><${type} ${attrs}>${children}</${type}></modify></osmChange>`;
}

/**
 * Save new tags of an element in a new changeset: create, upload the
 * osmChange, close. A changed version on the server fails with 409.
 */
export async function saveTags(
  element: OsmElement,
  tags: Tags,
  changesetTags: Tags,
  accessToken: string,
): Promise<{ changeset: number; version: number }> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "text/xml; charset=utf-8",
  };
  const res = await request("/changeset/create", {
    method: "PUT",
    headers,
    body: changesetXml(changesetTags),
  });
  const changeset = Number(await res.text());
  try {
    const diff = await request(`/changeset/${changeset}/upload`, {
      method: "POST",
      headers,
      body: osmChangeXml(element, tags, changeset),
    });
    const xml = new DOMParser().parseFromString(
      await diff.text(),
      "application/xml",
    );
    const version = Number(
      xml
        .querySelector(`${element.type}[old_id="${element.id}"]`)
        ?.getAttribute("new_version"),
    );
    return { changeset, version };
  } finally {
    await request(`/changeset/${changeset}/close`, {
      method: "PUT",
      headers,
    }).catch(console.warn);
  }
}

/** Changeset on the website. */
export function changesetUrl(id: number): string {
  return `${OSM_URL}/changeset/${id}`;
}
