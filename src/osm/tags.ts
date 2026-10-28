import type { Tags } from "./osm";
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

/**
 * Parse `key=value` lines (also tab-separated, or `"key"="value"` as copied
 * from taginfo or Overpass). Invalid lines are returned separately.
 */
export function parseTagText(text: string): { tags: Tags; invalid: string[] } {
  const tags: Tags = {};
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m =
      line.match(/^"([^"]+)"\s*=\s*"(.*)"\s*,?$/) ??
      line.match(/^([^=\t]+?)\s*(?:=|\t)\s*(.*)$/);
    const key = m?.[1].trim();
    const value = normalizeValue(m?.[2]);
    if (!key || !value || key.length > MAX_LENGTH || value.length > MAX_LENGTH)
      invalid.push(line);
    else tags[key] = value;
  }
  return { tags, invalid };
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
