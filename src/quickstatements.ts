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
      /** existing claim (removals) or generated ID (additions), for the UI */
      claimId: string;
      snak: Snak;
      qualifiers?: Snak[];
      references?: Snak[];
    };

const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

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
      return `${v.time}/${v.precision}`;
    case "quantity": {
      const unit = v.unit?.match(/Q\d+$/)?.[0];
      return unit ? `${v.amount}U${unit.slice(1)}` : v.amount;
    }
    case "globecoordinate":
      return `@${v.latitude}/${v.longitude}`;
  }
  return quote(JSON.stringify(value));
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
          return [
            `${edit.remove ? "-" : ""}${id}`,
            edit.snak.property,
            snakValue(edit.snak),
            ...(edit.qualifiers ?? []).flatMap((q) => [
              q.property,
              snakValue(q),
            ]),
            ...(edit.references ?? []).flatMap((r) => [
              r.property.replace(/^P/, "S"),
              snakValue(r),
            ]),
          ].join("|");
      }
    })
    .join("\n");
}
