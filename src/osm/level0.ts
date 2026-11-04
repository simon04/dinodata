/**
 * Level0L, the text format of the Level0 editor (level0.osmz.ru), following
 * its parser: https://github.com/Zverik/Level0/blob/master/www/level0l.php
 * https://wiki.openstreetmap.org/wiki/Level0L
 *
 * ```
 * way 123
 *   name = Main Street
 *   nd 1
 *   nd 2
 * ```
 */
import type { OsmElement, OsmMember, Tags } from "./osm";
import type { OsmRef, OsmType } from "./osm-ref";

/** An object header with its node or member references (tags aside). */
export interface Level0Object {
  type: OsmType;
  /** undefined or negative: new object */
  id?: number;
  /** `-way 123` */
  deleted?: boolean;
  lat?: number;
  lon?: number;
  nodes: number[];
  members: OsmMember[];
}

// `!` (conflict) and `-` (deleted) prefixes, optional ID, `.version`,
// node coordinates and a comment
const HEADER =
  /^!?(-)?(node|way|relation|changeset)(?:\s+(-?\d+)(?:\.\d+)?)?(?:\s*:\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?))?\s*(?:#.*)?$/;

/** Object header, `"changeset"` for changeset tags, or undefined. */
export function parseLevel0Header(
  line: string,
): Level0Object | "changeset" | undefined {
  const m = line.trim().match(HEADER);
  if (!m) return undefined;
  const [, deleted, type, id, lat, lon] = m;
  if (type === "changeset") return "changeset";
  return {
    type: type as OsmType,
    ...(id !== undefined ? { id: Number(id) } : {}),
    ...(deleted ? { deleted: true } : {}),
    ...(lat !== undefined ? { lat: Number(lat), lon: Number(lon) } : {}),
    nodes: [],
    members: [],
  };
}

const REF_TYPES: Record<string, OsmType> = {
  nd: "node",
  wy: "way",
  rel: "relation",
};
const REF = /^(nd|wy|rel)\s+(-?\d+)(?:\s+(.+?))?$/;

/** Adds a reference line (`nd 1`, `wy 2 role`) to the object; false if none. */
export function addLevel0Ref(object: Level0Object, line: string): boolean {
  const m = line.trim().match(REF);
  if (!m) return false;
  const [, kind, ref, role = ""] = m;
  if (object.type === "way") object.nodes.push(Number(ref));
  else if (object.type === "relation")
    object.members.push({ type: REF_TYPES[kind], ref: Number(ref), role });
  return true;
}

export function isLevel0Comment(line: string): boolean {
  return line.startsWith("#");
}

/** `way 123`, `node` for a new one */
export function level0Label({ type, id }: Pick<Level0Object, "type" | "id">) {
  return id !== undefined && id > 0 ? `${type} ${id}` : type;
}

export function isSameObject(object: Level0Object, ref: OsmRef): boolean {
  return object.type === ref.type && object.id === ref.id;
}

const REF_KINDS: Record<OsmType, string> = {
  node: "nd",
  way: "wy",
  relation: "rel",
};

/**
 * The element as Level0 text: header without version (as recommended), tags
 * sorted by key with `\=` in keys, and all node or member references, without
 * which Level0 would remove them.
 */
export function formatLevel0(element: OsmElement, tags: Tags): string {
  const { type, id, lat, lon } = element;
  return [
    type === "node" ? `${type} ${id}: ${lat}, ${lon}` : `${type} ${id}`,
    ...Object.keys(tags)
      .sort()
      .map((k) => `  ${k.replace(/=/g, "\\=")} = ${tags[k]}`),
    ...(element.nodes ?? []).map((ref) => `  nd ${ref}`),
    ...(element.members ?? []).map((m) =>
      `  ${REF_KINDS[m.type]} ${m.ref} ${m.role}`.trimEnd(),
    ),
  ].join("\n");
}
