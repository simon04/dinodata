import { shallowRef, watch, type Ref } from "vue";
import { createGlobalState } from "@vueuse/core";
import { cachedFetch } from "../cache";
import { isClosed, type OsmElement, type Tags } from "./osm";

/**
 * Presets and fields of the iD tagging schema (ISC license), also used by
 * iD, Rapid and Go Map!!: what an object is ("Restaurant"), which fields it
 * has, translated labels and options, deprecated tags.
 * https://github.com/openstreetmap/id-tagging-schema
 */

const CDN = "https://cdn.jsdelivr.net/npm/@openstreetmap/id-tagging-schema@6";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export type Geometry = "point" | "vertex" | "line" | "area" | "relation";

export interface RawPreset {
  tags: Tags;
  addTags?: Tags;
  removeTags?: Tags;
  geometry: Geometry[];
  fields?: string[];
  moreFields?: string[];
  icon?: string;
  matchScore?: number;
  searchable?: boolean;
  name?: string;
  reference?: { key: string; value?: string };
}

export interface RawField {
  key?: string;
  keys?: string[];
  type: string;
  options?: string[];
  label?: string;
  placeholder?: string;
  geometry?: Geometry[];
  prerequisiteTag?: {
    key?: string;
    keyNot?: string;
    value?: string;
    valueNot?: string;
  };
  default?: string;
  universal?: boolean;
  snake_case?: boolean;
  caseSensitive?: boolean;
  minValue?: number;
  maxValue?: number;
  customValues?: boolean;
  urlFormat?: string;
  pattern?: string;
  stringsCrossReference?: string;
  reference?: { key: string; value?: string };
}

interface FieldStrings {
  label?: string;
  placeholder?: string;
  terms?: string;
  options?: Record<string, string | { title: string; description?: string }>;
  placeholders?: Record<string, string>;
  labels?: Record<string, string>;
  types?: Record<string, string>;
}

interface Strings {
  presets: Record<string, { name?: string; terms?: string }>;
  fields: Record<string, FieldStrings>;
}

export interface Deprecation {
  old: Tags;
  replace?: Tags;
}

export interface Schema {
  presets: Record<string, RawPreset>;
  fields: Record<string, RawField>;
  deprecated: Deprecation[];
  /** English and the user language, if translated */
  strings: Strings[];
}

export interface Preset {
  id: string;
  name: string;
  icon?: string;
  tags: Tags;
  geometry: Geometry[];
  /** search terms, translated */
  terms: string[];
  searchable: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface Field {
  id: string;
  type: string;
  /** main key, e.g. `name`, `addr`, `diet:` (prefix of multiCombo) */
  key?: string;
  /** all keys edited by the field, e.g. `phone`, `contact:phone` */
  keys: string[];
  label: string;
  placeholder?: string;
  options: FieldOption[];
  /** free values besides the options */
  customValues: boolean;
  raw: RawField;
  /** labels and placeholders per sub-key of address fields */
  labels?: Record<string, string>;
  placeholders?: Record<string, string>;
}

async function getJson<T>(path: string): Promise<T> {
  return JSON.parse(
    await cachedFetch(`${CDN}/dist/${path}`, {
      cacheName: "osm-schema",
      maxAge: MAX_AGE,
      staleWhileRevalidate: true,
    }),
  );
}

/** Wikimedia language code → language code of the schema translations. */
export function schemaLanguage(
  code: string,
  available: string[],
): string | undefined {
  const lower = code.toLowerCase();
  const special: Record<string, string> = {
    "zh-hans": "zh-CN",
    "zh-hant": "zh-TW",
    "zh-hk": "zh-HK",
    "be-tarask": "be@tarask",
  };
  const candidates = [special[lower], lower, lower.split("-")[0]];
  for (const candidate of candidates)
    if (candidate) {
      const match = available.find(
        (a) => a.toLowerCase() === candidate.toLowerCase(),
      );
      if (match) return match;
    }
  return undefined;
}

async function loadStrings(language: string): Promise<Strings | undefined> {
  if (language === "en") return undefined;
  const index = await getJson<Record<string, { pct: number }>>(
    "translations/index.min.json",
  );
  const code = schemaLanguage(language, Object.keys(index));
  if (!code || code === "en") return undefined;
  const json = await getJson<Record<string, { presets: Strings }>>(
    `translations/${code}.min.json`,
  );
  return json[code]?.presets;
}

export const useSchema = createGlobalState(() => {
  const schema = shallowRef<Schema>();
  let base: Promise<Omit<Schema, "strings"> & { en: Strings }> | undefined;
  function load(language: Ref<string>) {
    base ??= Promise.all([
      getJson<Record<string, RawPreset>>("presets.min.json"),
      getJson<Record<string, RawField>>("fields.min.json"),
      getJson<Deprecation[]>("deprecated.min.json"),
      getJson<{ en: { presets: Strings } }>("translations/en.min.json"),
    ]).then(([presets, fields, deprecated, en]) => ({
      presets,
      fields,
      deprecated,
      en: en.en.presets,
    }));
    watch(
      language,
      async (code) => {
        const [b, strings] = await Promise.all([
          base!,
          loadStrings(code).catch(() => undefined),
        ]);
        if (code !== language.value) return;
        schema.value = {
          presets: b.presets,
          fields: b.fields,
          deprecated: b.deprecated,
          strings: strings ? [strings, b.en] : [b.en],
        };
      },
      { immediate: true },
    );
  }
  return { schema, load };
});

/** `amenity/fast_food` → `Fast Food` */
export function humanize(value: string): string {
  const text = value.split("/").pop()!.replace(/[_:]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Geometries an element can have, without loading its nodes. */
export function geometries(
  element: Pick<OsmElement, "type" | "nodes" | "tags">,
): Geometry[] {
  const tags = element.tags ?? {};
  if (element.type === "node") return ["point", "vertex"];
  if (element.type === "way") {
    if (!isClosed(element)) return ["line"];
    return tags.area === "no" ? ["line", "area"] : ["area", "line"];
  }
  return tags.type === "multipolygon" || tags.type === "boundary"
    ? ["area", "relation"]
    : ["relation"];
}

/** Score of a preset for the tags, like iD; -1 if it does not match. */
export function matchScore(preset: RawPreset, tags: Tags): number {
  const base = preset.matchScore ?? 1;
  let score = 0;
  for (const [key, value] of Object.entries(preset.tags)) {
    if (key.endsWith("*")) {
      // e.g. addr:*
      const prefix = key.slice(0, -1);
      if (!Object.keys(tags).some((k) => k.startsWith(prefix))) return -1;
      score += base / 2;
    } else if (tags[key] === value) score += base;
    else if (value === "*" && key in tags && tags[key] !== "no")
      score += base / 2;
    else return -1;
  }
  for (const [key, value] of Object.entries(preset.addTags ?? {}))
    if (!(key in preset.tags) && tags[key] === value) score += base;
  if (preset.searchable === false) score *= 0.999;
  return score;
}

function strings(schema: Schema) {
  return {
    preset(id: string) {
      for (const s of schema.strings) if (s.presets[id]) return s.presets[id];
      return undefined;
    },
    field(id: string) {
      for (const s of schema.strings) if (s.fields[id]) return s.fields[id];
      return undefined;
    },
  };
}

/** `{building}` → `building` */
const reference = (text?: string) => text?.match(/^\{(.+)\}$/)?.[1];

function presetName(schema: Schema, id: string, depth = 0): string {
  const raw = schema.presets[id];
  const ref = reference(raw?.name);
  if (ref && depth < 3) return presetName(schema, ref, depth + 1);
  return strings(schema).preset(id)?.name ?? humanize(id);
}

function toPreset(schema: Schema, id: string): Preset {
  const raw = schema.presets[id];
  return {
    id,
    name: presetName(schema, id),
    icon: raw.icon,
    tags: raw.tags,
    geometry: raw.geometry,
    terms: (strings(schema).preset(id)?.terms ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    searchable: raw.searchable !== false,
  };
}

/** The best matching preset, or the fallback for the geometry. */
export function matchPreset(
  schema: Schema,
  tags: Tags,
  geometry: Geometry[],
): Preset {
  let best: string | undefined;
  let bestScore = 0;
  for (const [id, raw] of Object.entries(schema.presets)) {
    if (id.startsWith("@")) continue;
    if (!Object.keys(raw.tags).length) continue;
    if (!raw.geometry.some((g) => geometry.includes(g))) continue;
    const score = matchScore(raw, tags);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  const fallback = geometry[0] === "vertex" ? "point" : geometry[0];
  return toPreset(schema, best ?? fallback);
}

/** Presets for the preset picker, best matching the query first. */
export function searchPresets(
  schema: Schema,
  query: string,
  geometry: Geometry[],
  limit = 30,
): Preset[] {
  const q = query.trim().toLowerCase();
  const results: { preset: Preset; rank: number }[] = [];
  for (const [id, raw] of Object.entries(schema.presets)) {
    if (id.startsWith("@") || raw.searchable === false) continue;
    if (!Object.keys(raw.tags).length) continue;
    if (!raw.geometry.some((g) => geometry.includes(g))) continue;
    const preset = toPreset(schema, id);
    const name = preset.name.toLowerCase();
    const rank = !q
      ? 3
      : name === q
        ? 0
        : name.startsWith(q)
          ? 1
          : name.includes(q) || preset.terms.some((t) => t.startsWith(q))
            ? 2
            : Object.entries(raw.tags).some(([k, v]) => `${k}=${v}`.includes(q))
              ? 3
              : -1;
    if (rank >= 0) results.push({ preset, rank });
  }
  return results
    .sort(
      (a, b) => a.rank - b.rank || a.preset.name.localeCompare(b.preset.name),
    )
    .slice(0, limit)
    .map((r) => r.preset);
}

function toField(schema: Schema, id: string): Field | undefined {
  const raw = schema.fields[id];
  if (!raw) return undefined;
  const s = strings(schema);
  // labels and options may be shared with another field: {building}
  const labelId = reference(raw.label) ?? id;
  const optionsId = reference(raw.stringsCrossReference) ?? id;
  const str = s.field(labelId);
  const optionStrings = s.field(optionsId)?.options ?? str?.options ?? {};
  const values =
    raw.options ??
    (["check", "defaultCheck"].includes(raw.type)
      ? ["yes", "no"]
      : Object.keys(optionStrings));
  const options = values.map((value) => {
    const o = optionStrings[value];
    return typeof o === "object"
      ? { value, label: o.title, description: o.description }
      : { value, label: o ?? humanize(value) };
  });
  return {
    id,
    type: raw.type,
    key: raw.key,
    keys: raw.keys ?? (raw.key ? [raw.key] : []),
    label: str?.label ?? humanize(raw.key ?? id),
    placeholder: str?.placeholder,
    options,
    customValues:
      raw.customValues !== false &&
      !["check", "defaultCheck", "onewayCheck", "radio"].includes(raw.type),
    raw,
    labels: str?.labels,
    placeholders: str?.placeholders,
  };
}

function fieldIds(
  schema: Schema,
  id: string,
  which: "fields" | "moreFields",
  depth = 0,
): string[] {
  const raw = schema.presets[id];
  if (!raw || depth > 5) return [];
  const own = raw[which];
  // no fields: inherited from the parent preset (amenity/cafe → amenity)
  if (!own?.length) {
    const parent = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "";
    if (!parent) return [];
    return fieldIds(schema, parent, which, depth + 1).filter((f) => {
      const key = schema.fields[f]?.key;
      return !key || !(key in raw.tags);
    });
  }
  return own.flatMap((f) => {
    const ref = reference(f);
    return ref ? fieldIds(schema, ref, which, depth + 1) : [f];
  });
}

/** The field applies to the geometry and its prerequisite tag is set. */
function applies(field: Field, tags: Tags, geometry: Geometry[]): boolean {
  if (
    field.raw.geometry &&
    !field.raw.geometry.some((g) => geometry.includes(g))
  )
    return false;
  const pre = field.raw.prerequisiteTag;
  if (pre) {
    if (pre.keyNot && pre.keyNot in tags) return false;
    if (pre.key) {
      const value = tags[pre.key];
      if (value === undefined) return false;
      if (pre.value !== undefined && value !== pre.value) return false;
      if (pre.valueNot !== undefined && value === pre.valueNot) return false;
    }
  }
  return true;
}

/**
 * Fields of a preset (always shown) and more fields (shown when used),
 * including universal fields like website or phone.
 */
export function presetFields(
  schema: Schema,
  presetId: string,
  tags: Tags,
  geometry: Geometry[],
): { fields: Field[]; moreFields: Field[] } {
  const ids = [...new Set(fieldIds(schema, presetId, "fields"))];
  const more = [
    ...new Set([
      ...fieldIds(schema, presetId, "moreFields"),
      ...Object.entries(schema.fields)
        .filter(([, f]) => f.universal)
        .map(([id]) => id),
    ]),
  ].filter((id) => !ids.includes(id));
  const resolve = (list: string[]) =>
    list.flatMap((id) => {
      const field = toField(schema, id);
      return field && applies(field, tags, geometry) ? [field] : [];
    });
  return { fields: resolve(ids), moreFields: resolve(more) };
}

/** Field of the schema by ID, e.g. for a tag without preset field. */
export function getField(schema: Schema, id: string): Field | undefined {
  return toField(schema, id);
}

/**
 * Tag keys a field edits: its keys, prefixed keys of multiCombo fields
 * (`diet:vegan`), localized names (`name:de`), and address sub-keys.
 */
export function fieldMatchesKey(field: Field, key: string): boolean {
  if (field.keys.includes(key)) return true;
  if (field.type === "multiCombo" && field.key?.endsWith(":"))
    return key.startsWith(field.key);
  if (field.type === "localized" && field.key)
    return (
      key.startsWith(`${field.key}:`) &&
      /^[a-z]{2,3}(-|$)/.test(key.slice(field.key.length + 1))
    );
  if (field.type === "address") return key.startsWith("addr:");
  return false;
}

/** Translated name of the preset of a place, e.g. for search results. */
export function placeType(place: { key?: string; value?: string }): string {
  const { schema } = useSchema();
  const { key, value } = place;
  if (!key || !value) return "";
  const s = schema.value;
  if (s) {
    const id = s.presets[`${key}/${value}`]
      ? `${key}/${value}`
      : s.presets[key]
        ? key
        : undefined;
    if (id) return presetName(s, id);
  }
  return humanize(value === "yes" ? key : value);
}

/** Icon URL (SVG, used as mask) of a preset icon like `maki-restaurant`. */
export function iconUrl(icon?: string): string | undefined {
  const m = icon?.match(/^(maki|temaki|fas|far|iD)-(.+)$/);
  if (!m) return undefined;
  const [, set, name] = m;
  switch (set) {
    case "maki":
      return `https://cdn.jsdelivr.net/npm/@mapbox/maki@8/icons/${name}.svg`;
    case "temaki":
      return `https://cdn.jsdelivr.net/npm/@rapideditor/temaki@5/icons/${name}.svg`;
    case "fas":
      return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/solid/${name}.svg`;
    case "far":
      return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/regular/${name}.svg`;
    default:
      return `https://cdn.jsdelivr.net/gh/openstreetmap/iD@release/svg/iD-sprite/presets/${name}.svg`;
  }
}

/** Deprecated tags of the element with their replacement. */
export function deprecations(schema: Schema, tags: Tags): Deprecation[] {
  return schema.deprecated.filter((d) =>
    Object.entries(d.old).every(([k, v]) =>
      v === "*" ? k in tags : tags[k] === v,
    ),
  );
}

/**
 * Change the preset like iD: remove the tags of the old preset (its
 * `removeTags`, `addTags` or `tags`), add those of the new one; `*` keeps an
 * existing value or sets `yes`.
 */
export function changePresetPatch(
  schema: Schema,
  oldId: string,
  newId: string,
  tags: Tags,
): Record<string, string | undefined> {
  const patch: Record<string, string | undefined> = {};
  const old = schema.presets[oldId];
  const remove = old?.removeTags ?? old?.addTags ?? old?.tags ?? {};
  for (const [key, value] of Object.entries(remove))
    if (value === "*" || tags[key] === value) patch[key] = undefined;
  const add = schema.presets[newId]?.addTags ?? schema.presets[newId]?.tags;
  for (const [key, value] of Object.entries(add ?? {}))
    patch[key] = value === "*" ? (tags[key] ?? "yes") : value;
  return patch;
}

const keyFields = new WeakMap<Schema, Map<string, string>>();

/**
 * A field of the schema for a key, for translated options of tags shown
 * without their preset field (e.g. `surface` on a building).
 */
export function fieldForKey(schema: Schema, key: string): Field | undefined {
  let map = keyFields.get(schema);
  if (!map) {
    map = new Map();
    for (const [id, f] of Object.entries(schema.fields))
      for (const k of f.keys ?? (f.key ? [f.key] : []))
        // prefer fields with options, e.g. "surface" over "surface/paved"
        if (!map.has(k) || (f.options && !schema.fields[map.get(k)!]?.options))
          map.set(k, id);
  }
  keyFields.set(schema, map);
  const id = map.get(key);
  return id ? toField(schema, id) : undefined;
}
