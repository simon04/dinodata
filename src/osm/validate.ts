import type { MessageKey } from "../i18n";
import type { OsmElement, Tags } from "./osm";
import type { TagDoc } from "./osmwiki";
import { isClosed } from "./osm";
import type { Deprecation } from "./presets";
import { MAX_LENGTH, parseTagText, upgradePatch, type TagPatch } from "./tags";

/** A problem of the tags, with a fix if there is an obvious one. */
export interface Issue {
  severity: "error" | "warning" | "notice";
  /** key the issue is about, for showing its documentation */
  key: string;
  message: MessageKey;
  params: string[];
  fix?: TagPatch;
}

const tagText = (tags: Tags) =>
  Object.entries(tags)
    .map(([k, v]) => (v === "*" || v === "$1" ? k : `${k}=${v}`))
    .join(" + ");

/** `highway=footway` → tags; `surface` → a key to rename to */
function parseItemLabel(label: string): { tags?: Tags; key?: string } {
  if (label.includes("=")) {
    const { tags } = parseTagText(label);
    return Object.keys(tags).length ? { tags } : {};
  }
  return /^[\w:]+$/.test(label) ? { key: label } : {};
}

/**
 * Issues of the tags: deprecated tags (iD schema and OSM wiki status),
 * values not matching the wiki's validation regex, tags not meant for the
 * element type, incompatible tags, missing required tags, too long values.
 */
export function validate(
  element: Pick<OsmElement, "type" | "nodes">,
  tags: Tags,
  docs: Record<string, TagDoc>,
  itemLabels: Record<string, string>,
  deprecated: Deprecation[],
): Issue[] {
  const issues: Issue[] = [];
  const handled = new Set<string>();

  for (const d of deprecated) {
    const matches = Object.entries(d.old).every(([k, v]) =>
      v === "*" ? k in tags : tags[k] === v,
    );
    if (!matches) continue;
    const key = Object.keys(d.old)[0];
    Object.keys(d.old).forEach((k) => handled.add(k));
    issues.push({
      severity: "warning",
      key,
      message: d.replace
        ? "osm-issue-deprecated"
        : "osm-issue-deprecated-remove",
      params: [tagText(d.old), d.replace ? tagText(d.replace) : ""],
      fix: upgradePatch(tags, d),
    });
  }

  const area = element.type === "way" && isClosed(element);
  for (const [key, value] of Object.entries(tags)) {
    if (value.length > MAX_LENGTH || key.length > MAX_LENGTH)
      issues.push({
        severity: "error",
        key,
        message: "osm-issue-too-long",
        params: [key, String(MAX_LENGTH)],
      });

    const tagDoc = docs[`${key}=${value}`];
    const keyDoc = docs[key];

    // discouraged on the wiki (and not already a deprecation of the schema)
    for (const doc of [tagDoc, keyDoc]) {
      if (!doc?.discouraged || handled.has(key)) continue;
      handled.add(key);
      const replacement = doc.replacedBy
        .map((id) => itemLabels[id])
        .find(Boolean);
      const parsed = replacement ? parseItemLabel(replacement) : {};
      const fix: TagPatch | undefined = parsed.tags
        ? { [key]: undefined, ...parsed.tags }
        : parsed.key && doc === keyDoc
          ? { [key]: undefined, [parsed.key]: value }
          : undefined;
      issues.push({
        severity: "warning",
        key,
        message: replacement
          ? "osm-issue-discouraged-replace"
          : "osm-issue-discouraged",
        params: [
          doc === tagDoc ? `${key}=${value}` : key,
          itemLabels[doc.status ?? ""] ?? "",
          replacement ?? "",
        ],
        fix,
      });
    }

    // the wiki's regex is for the whole value (several with ;)
    if (keyDoc?.regex) {
      let regex: RegExp | undefined;
      try {
        regex = new RegExp(`^(?:${keyDoc.regex})$`, "u");
      } catch {
        // invalid regex on the wiki
      }
      if (regex && !value.split(";").every((v) => regex.test(v.trim())))
        issues.push({
          severity: "warning",
          key,
          message: "osm-issue-format",
          params: [key, value],
        });
    }

    // not meant for this element type, if the wiki says so for key and tag
    const doc = tagDoc ?? keyDoc;
    if (doc) {
      const applies = doc.appliesTo;
      const type = element.type;
      const wrong =
        type === "way"
          ? applies.way === false && !(area && applies.area !== false)
          : applies[type] === false;
      if (wrong)
        issues.push({
          severity: "notice",
          key,
          message: `osm-issue-type-${type}`,
          params: [tagDoc ? `${key}=${value}` : key],
        });
    }

    for (const id of doc?.incompatible ?? []) {
      const label = itemLabels[id];
      const other = label ? parseItemLabel(label) : {};
      const conflicting =
        (other.key && other.key in tags) ||
        (other.tags &&
          Object.entries(other.tags).every(([k, v]) => tags[k] === v));
      if (conflicting)
        issues.push({
          severity: "warning",
          key,
          message: "osm-issue-incompatible",
          params: [tagDoc ? `${key}=${value}` : key, label],
        });
    }
  }

  // keep each message once, e.g. incompatible tags reported from both sides
  const seen = new Set<string>();
  return issues.filter((i) => {
    const id = `${i.message}|${[...i.params].sort().join("|")}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
