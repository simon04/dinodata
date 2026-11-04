import {
  addLevel0Ref,
  isLevel0Comment,
  isSameObject,
  parseLevel0Header,
  type Level0Object,
} from "./level0";
import type { Tags } from "./osm";
import type { OsmRef } from "./osm-ref";
import type { Deprecation } from "./presets";

/** Tag changes: `undefined` removes the key. */
export type TagPatch = Record<string, string | undefined>;

export interface TagChange {
  key: string;
  /** undefined: added */
  old?: string;
  /** undefined: removed */
  new?: string;
}

/** OSM limit for keys and values (characters). */
export const MAX_LENGTH = 255;

/** Trimmed value with single spaces; empty → undefined (remove the tag). */
export function normalizeValue(value: string | undefined): string | undefined {
  const v = value?.replace(/\s+/g, " ").trim();
  return v ? v : undefined;
}

export function applyPatch(tags: Tags, patch: TagPatch): Tags {
  const result = { ...tags };
  for (const [key, value] of Object.entries(patch)) {
    const k = key.trim();
    if (!k) continue;
    const v = normalizeValue(value);
    if (v === undefined) delete result[k];
    else result[k] = v;
  }
  return result;
}

/** Changes from `base` to `current`, sorted by key. */
export function diffTags(base: Tags, current: Tags): TagChange[] {
  const keys = [...new Set([...Object.keys(base), ...Object.keys(current)])];
  return keys
    .filter((k) => base[k] !== current[k])
    .sort()
    .map((key) => ({ key, old: base[key], new: current[key] }));
}

export function tagState(
  base: Tags,
  current: Tags,
  key: string,
): "added" | "changed" | "removed" | undefined {
  if (base[key] === current[key]) return undefined;
  if (base[key] === undefined) return "added";
  if (current[key] === undefined) return "removed";
  return "changed";
}

/** Tags as `key=value` lines, sorted by key. */
export function formatTagText(tags: Tags): string {
  return Object.keys(tags)
    .sort()
    .map((k) => `${k}=${tags[k]}`)
    .join("\n");
}

export interface ParsedTagText {
  tags: Tags;
  /** `key=` without value, e.g. as copied from the changes */
  removed: string[];
  invalid: string[];
  /** Level0 object the tags were taken from */
  object?: Level0Object;
  /** other Level0 objects in the text, ignored */
  ignored: Level0Object[];
}

/** `key=value` or `key<TAB>value`, `\=` in keys like Level0; or `"key"="value"`. */
const TAG_LINE = /^((?:[^=\t\\]|\\.)+?)\s*(?:=|\t)\s*(.*)$/;
const QUOTED_TAG_LINE = /^"([^"]+)"\s*=\s*"(.*)"\s*,?$/;

interface Block {
  object?: Level0Object | "changeset";
  tags: Tags;
  removed: string[];
  invalid: string[];
}

/**
 * Parse `key=value` lines (also tab-separated, or `"key"="value"` as copied
 * from taginfo or Overpass), or Level0 text: of several objects, the tags of
 * `ref` (else of the first object) are taken; references and comments are
 * skipped. `key=` lines are returned as removed, invalid lines separately.
 */
export function parseTagText(text: string, ref?: OsmRef): ParsedTagText {
  const blocks: Block[] = [{ tags: {}, removed: [], invalid: [] }];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || isLevel0Comment(raw)) continue;
    const header = parseLevel0Header(line);
    if (header) {
      blocks.push({ object: header, tags: {}, removed: [], invalid: [] });
      continue;
    }
    const block = blocks[blocks.length - 1];
    if (typeof block.object === "object" && addLevel0Ref(block.object, line))
      continue;
    const m = line.match(QUOTED_TAG_LINE) ?? line.match(TAG_LINE);
    const key = m?.[1].replace(/\\=/g, "=").trim();
    const value = normalizeValue(m?.[2]);
    if (!key || key.length > MAX_LENGTH || (value?.length ?? 0) > MAX_LENGTH)
      block.invalid.push(line);
    else if (value === undefined) block.removed.push(key);
    else block.tags[key] = value;
  }
  const [loose, ...rest] = blocks;
  const objects = rest.filter(
    (b): b is Block & { object: Level0Object } => b.object !== "changeset",
  );
  const chosen =
    objects.find((b) => ref && isSameObject(b.object, ref)) ?? objects[0];
  return {
    tags: { ...loose.tags, ...chosen?.tags },
    removed: [...loose.removed, ...(chosen?.removed ?? [])],
    invalid: [...loose.invalid, ...(chosen?.invalid ?? [])],
    ...(chosen ? { object: chosen.object } : {}),
    ignored: objects.filter((b) => b !== chosen).map((b) => b.object),
  };
}

/** Patch turning `current` into `next` (all keys of both). */
export function patchTo(current: Tags, next: Tags): TagPatch {
  const patch: TagPatch = {};
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)]))
    if (current[key] !== next[key]) patch[key] = next[key];
  return patch;
}

/** `a;b` → `["a", "b"]` */
export function splitValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function joinValues(values: string[]): string | undefined {
  return values.length ? values.join(";") : undefined;
}

/**
 * Three-way merge of tag edits: `mine` and `theirs` both changed from
 * `base`. Keys changed on one side only are merged; keys changed on both
 * sides to different values are conflicts (theirs is kept for those).
 */
export function mergeTags(
  base: Tags,
  mine: Tags,
  theirs: Tags,
): { tags: Tags; conflicts: TagChange[] } {
  const tags: Tags = { ...theirs };
  const conflicts: TagChange[] = [];
  for (const { key, new: value } of diffTags(base, mine)) {
    if (theirs[key] === value) continue;
    if (theirs[key] === base[key]) {
      if (value === undefined) delete tags[key];
      else tags[key] = value;
    } else conflicts.push({ key, old: theirs[key], new: value });
  }
  return { tags, conflicts };
}

/**
 * Upgrade deprecated tags like iD: old tags are removed; `$1` takes the
 * value of the old wildcard tag, `*` keeps an existing value or sets `yes`.
 */
export function upgradePatch(tags: Tags, deprecation: Deprecation): TagPatch {
  const patch: TagPatch = {};
  let wildcardValue: string | undefined;
  for (const [key, value] of Object.entries(deprecation.old)) {
    if (value === "*") wildcardValue = tags[key];
    patch[key] = undefined;
  }
  for (const [key, value] of Object.entries(deprecation.replace ?? {})) {
    patch[key] =
      value === "$1"
        ? wildcardValue
        : value === "*"
          ? (tags[key] ?? "yes")
          : value;
  }
  return patch;
}

/** A line of a tag diff: `key=value` removed (-) or added (+). */
export interface TagDiffLine {
  type: "+" | "-";
  key: string;
  value: string;
}

/** Changes between two versions as lines, by key; a changed value is removed and added. */
export function tagDiffLines(before: Tags, after: Tags): TagDiffLine[] {
  return diffTags(before, after).flatMap(({ key, old, new: value }) => [
    ...(old !== undefined ? [{ type: "-" as const, key, value: old }] : []),
    ...(value !== undefined ? [{ type: "+" as const, key, value }] : []),
  ]);
}
