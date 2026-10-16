import { createSharedComposable, useClipboard } from "@vueuse/core";
import { t } from "./i18n";
import { toQuickStatements, type Edit } from "./quickstatements";
import { FORMAT_EXAMPLES, parseValue } from "./values";
import type { Claim, Snak } from "./wikidata";

/**
 * Copy/paste uses QuickStatements 3.0 lines — the same human-readable format
 * as the final export — as plain text, so it works across tabs and browsers.
 * https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation/User_guide
 */

/**
 * Clipboard with a fallback without the Clipboard API (e.g. over http),
 * shared as each instance queries the clipboard permissions.
 */
export const useSharedClipboard = createSharedComposable(() =>
  useClipboard({ legacy: true }),
);

type StatementEdit = Extract<Edit, { type: "statement" }>;
type TermEdit = Exclude<Edit, StatementEdit>;

export function claimToEdit(claim: Claim, claimId: string): StatementEdit {
  return {
    type: "statement",
    claimId,
    snak: claim.mainsnak,
    rank: claim.rank,
    qualifiers: Object.values(claim.qualifiers ?? {}).flat(),
    references: claim.references?.map((r) => Object.values(r.snaks).flat()),
  };
}

export async function copyClaims(claims: Claim[], source: string) {
  const text = toQuickStatements(
    source,
    claims.map((c) => claimToEdit(c, "")),
  );
  await navigator.clipboard.writeText(text);
}

/** Split a QuickStatements line on `|` or tabs, but not inside quotes. */
function fields(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && quoted) {
      current += c + (line[++i] ?? "");
    } else if (c === '"') {
      quoted = !quoted;
      current += c;
    } else if ((c === "|" || c === "\t") && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

const unquote = (s: string) => s.match(/^"(.*)"$/)?.[1].replace(/\\(.)/g, "$1");

type Properties = Record<string, { datatype: string }>;

function parseSnak(
  property: string,
  value: string,
  properties: Properties,
  language: string,
): Snak | string {
  const datatype = properties[property]?.datatype;
  if (!datatype) return `${property}?`;
  if (value === "somevalue" || value === "novalue")
    return { snaktype: value, property, datatype };
  const datavalue = parseValue(datatype, value, language);
  if (!datavalue) return `${property}=${FORMAT_EXAMPLES[datatype] ?? "…"}`;
  return { snaktype: "value", property, datatype, datavalue };
}

export interface Pasted {
  claims: Claim[];
  terms: TermEdit[];
  /** invalid lines, each with a hint */
  invalid: string[];
}

/**
 * Parse QuickStatements lines (the subject is ignored: statements go to the
 * current item) and `Pxxx=value` lines. Statements repeated with different
 * references are merged. Returns undefined if no line looks like either.
 */
export function parseStatements(
  text: string,
  properties: Properties,
  language: string,
): Pasted | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const qsLine = /^-?(Q\d+|L\d+|P\d+|LAST)\s*[|\t]/i;
  const pvLine = /^P\d+\s*=/i;
  if (!lines.some((l) => qsLine.test(l) || pvLine.test(l))) return undefined;

  const result: Pasted = { claims: [], terms: [], invalid: [] };
  const byKey = new Map<string, Claim>();
  for (const line of lines) {
    const fail = (hint?: string) =>
      result.invalid.push(hint ? `${line} (${hint})` : line);

    // Pxxx=value
    const pv = line.match(/^(P\d+)\s*=\s*(.+)$/i);
    // QuickStatements: SUBJECT|P|value|P|value…|S|value…
    const qs = qsLine.test(line) ? fields(line) : undefined;
    if (!pv && !qs) {
      fail();
      continue;
    }
    if (line.startsWith("-")) {
      fail(t("paste-no-removal"));
      continue;
    }
    if (qs) {
      const [, command, value] = qs;
      const term = command?.match(/^([LDAS])(.+)$/);
      if (term) {
        const texts = qs.slice(2).map(unquote);
        if (texts.some((t) => t === undefined)) fail('"…"');
        else if (term[1] === "S")
          result.terms.push({
            type: "sitelink",
            site: term[2],
            title: texts[0]!,
          });
        else
          for (const t of term[1] === "A" ? texts : texts.slice(0, 1))
            result.terms.push({
              type: { L: "label", D: "description", A: "alias" }[term[1]] as
                | "label"
                | "description"
                | "alias",
              language: term[2],
              value: t!,
            });
        continue;
      }
      if (!/^P\d+$/i.test(command ?? "") || value === undefined) {
        fail();
        continue;
      }
    }
    const [property, value, ...rest] = pv ? [pv[1], pv[2]] : qs!.slice(1);
    const mainsnak = parseSnak(
      property.toUpperCase(),
      value,
      properties,
      language,
    );
    if (typeof mainsnak === "string") {
      fail(mainsnak);
      continue;
    }
    const qualifiers: Snak[] = [];
    const reference: Snak[] = [];
    let error: string | undefined;
    let rank: Claim["rank"] = "normal";
    const RANKS: Record<string, Claim["rank"]> = {
      "R+": "preferred",
      RPREFERRED: "preferred",
      R0: "normal",
      RNORMAL: "normal",
      "R-": "deprecated",
      RDEPRECATED: "deprecated",
    };
    while (RANKS[rest[0]?.toUpperCase()])
      rank = RANKS[rest.shift()!.toUpperCase()];
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const [p, v] = [rest[i].toUpperCase(), rest[i + 1]];
      const target = p.startsWith("S") ? reference : qualifiers;
      const snak = parseSnak(p.replace(/^S/, "P"), v, properties, language);
      if (typeof snak === "string") error = snak;
      else target.push(snak);
    }
    if (error || rest.length % 2) {
      fail(error);
      continue;
    }
    const group = (snaks: Snak[]) => {
      const record: Record<string, Snak[]> = {};
      for (const s of snaks) (record[s.property] ??= []).push(s);
      return record;
    };
    // same statement on several lines: one line per reference
    const key = toQuickStatements("", [
      claimToEdit(
        { id: "", rank: "normal", mainsnak, qualifiers: group(qualifiers) },
        "",
      ),
    ]);
    let claim = byKey.get(key);
    if (!claim) {
      claim = {
        id: "",
        rank,
        mainsnak,
        qualifiers: qualifiers.length ? group(qualifiers) : undefined,
      };
      byKey.set(key, claim);
      result.claims.push(claim);
    }
    if (reference.length)
      (claim.references ??= []).push({ snaks: group(reference) });
  }
  return result;
}

/** Wikidata entity JSON (e.g. Special:EntityData), as a convenience. */
export function parseEntityJson(text: string): Claim[] | undefined {
  let json: {
    claims?: unknown;
    entities?: Record<string, { claims?: unknown }>;
  };
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const isClaim = (c: unknown): c is Claim =>
    typeof c === "object" &&
    c !== null &&
    typeof (c as Claim).mainsnak?.property === "string";
  const claimsOf = (x: unknown): Claim[] =>
    typeof x === "object" && x !== null
      ? Object.values(x).flat().filter(isClaim)
      : [];
  const claims = json.entities
    ? Object.values(json.entities).flatMap((e) => claimsOf(e.claims))
    : claimsOf(json.claims);
  return claims.length ? claims : undefined;
}
