import type { Snak } from "./wikidata";

// https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation/User_guide
export type Edit =
  /** empty value removes the label/description */
  | { type: "label" | "description"; language: string; value: string }
  | { type: "alias"; language: string; value: string; remove?: boolean }
  /** empty title removes the sitelink */
  | { type: "sitelink"; site: string; title: string }
  | {
      type: "statement";
      remove?: boolean;
      /**
       * change of an existing statement (main value, qualifiers and/or
       * references): exported as SWITCH_VALUE, REMOVE_QUAL and qualifiers
       * and references added to the matching statement, keeping its ID and
       * rank; references are only changed if the original ones are given
       */
      original?: { snak: Snak; qualifiers: Snak[]; references?: Snak[][] };
      rank?: "preferred" | "normal" | "deprecated";
      /** existing claim (removals) or generated ID (additions), for the UI */
      claimId: string;
      snak: Snak;
      qualifiers?: Snak[];
      /** each reference is a group of snaks */
      references?: Snak[][];
    };

export const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

export function snakValue(snak: Snak): string {
  if (snak.snaktype !== "value") return snak.snaktype;
  const { type, value } = snak.datavalue!;
  const v = value as Record<string, string>;
  switch (type) {
    case "wikibase-entityid":
      return v.id;
    case "string":
      return quote(value as string);
    case "monolingualtext":
      return `${v.language}:${quote(v.text)}`;
    case "time":
      // /J: Julian calendar
      return `${v.time}/${v.precision}${v.calendarmodel?.endsWith("/Q1985786") ? "/J" : ""}`;
    case "quantity": {
      const unit = v.unit?.match(/Q\d+$/)?.[0];
      return unit ? `${v.amount}U${unit.slice(1)}` : v.amount;
    }
    case "globecoordinate":
      return `@${v.latitude}/${v.longitude}`;
  }
  return quote(JSON.stringify(value));
}

export type StatementEdit = Extract<Edit, { type: "statement" }>;

export const snakKey = (snak: Snak) => `${snak.property}|${snakValue(snak)}`;

/** Snaks of `a` not in `b` (as multisets). */
function without(a: Snak[], b: Snak[]): Snak[] {
  const rest = b.map(snakKey);
  return a.filter((snak) => {
    const i = rest.indexOf(snakKey(snak));
    if (i < 0) return true;
    rest.splice(i, 1);
    return false;
  });
}

/** A reference as text, to compare references regardless of their hash. */
export const referenceKey = (snaks: Snak[]) => snaks.map(snakKey).join("|");

/** References of `a` not in `b` (as multisets). */
function referencesWithout(a: Snak[][], b: Snak[][]): Snak[][] {
  const rest = b.map(referenceKey);
  return a.filter((snaks) => {
    const i = rest.indexOf(referenceKey(snaks));
    if (i < 0) return true;
    rest.splice(i, 1);
    return false;
  });
}

/** References removed (or changed) by an edit of an existing statement. */
const removedReferences = (edit: StatementEdit): Snak[][] =>
  edit.original?.references
    ? referencesWithout(edit.original.references, edit.references ?? [])
    : [];

/**
 * Whether the QuickStatements export misses some edits: it can add
 * references to a statement, but not remove them.
 */
export const hasUnexportableEdits = (edits: Edit[]) =>
  edits.some((e) => e.type === "statement" && removedReferences(e).length > 0);

/**
 * Change an existing statement in place: statements are matched by
 * property and value, an existing match gets the qualifiers added.
 */
function changeStatement(id: string, edit: StatementEdit): string {
  const { original, snak } = edit;
  const property = snak.property;
  const value = snakValue(snak);
  const oldValue = snakValue(original!.snak);
  const qualifiers = edit.qualifiers ?? [];
  const removed = without(original!.qualifiers, qualifiers);
  const added = without(qualifiers, original!.qualifiers);
  return [
    ...(value !== oldValue
      ? [`SWITCH_VALUE|${id}|${property}|${oldValue}|${value}`]
      : []),
    ...removed.map(
      (q) => `REMOVE_QUAL|${id}|${property}|${value}|${snakKey(q)}`,
    ),
    ...(added.length
      ? [[id, property, value, ...added.map(snakKey)].join("|")]
      : []),
    // one line per added reference, merged into the matching statement
    ...(original!.references
      ? referencesWithout(edit.references ?? [], original!.references)
      : []
    ).map((reference) =>
      [
        id,
        property,
        value,
        ...reference.map((r) => snakKey(r).replace(/^P/, "S")),
      ].join("|"),
    ),
  ].join("\n");
}

export function toQuickStatements(id: string, edits: Edit[]): string {
  return edits
    .map((edit) => {
      switch (edit.type) {
        case "label":
          return `${id}|L${edit.language}|${quote(edit.value)}`;
        case "description":
          return `${id}|D${edit.language}|${quote(edit.value)}`;
        case "alias":
          return `${edit.remove ? "-" : ""}${id}|A${edit.language}|${quote(edit.value)}`;
        case "sitelink":
          return `${id}|S${edit.site}|${quote(edit.title)}`;
        case "statement":
          // existing statements are removed precisely by their ID
          if (edit.remove && !edit.claimId.startsWith("new-"))
            return `-STATEMENT|${edit.claimId}`;
          if (edit.original) return changeStatement(id, edit);
          const statement = [
            `${edit.remove ? "-" : ""}${id}`,
            edit.snak.property,
            snakValue(edit.snak),
            ...(edit.rank && edit.rank !== "normal" && !edit.remove
              ? [edit.rank === "preferred" ? "R+" : "R-"]
              : []),
            ...(edit.qualifiers ?? []).flatMap((q) => [
              q.property,
              snakValue(q),
            ]),
          ];
          // one line per reference, QuickStatements merges the statements
          const references = edit.references?.length ? edit.references : [[]];
          return references
            .map((reference) =>
              [
                ...statement,
                ...reference.flatMap((r) => [
                  r.property.replace(/^P/, "S"),
                  snakValue(r),
                ]),
              ].join("|"),
            )
            .join("\n");
      }
    })
    .join("\n");
}
