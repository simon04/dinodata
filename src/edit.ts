import { snakKey, type Edit, type StatementEdit } from "./quickstatements";
import type { Claim, Entity, Snak } from "./wikidata";

/**
 * Pending edits as `wbeditentity` data, saved in one revision. Statements are
 * changed by their ID, keeping rank and references; removals of pasted
 * statements (without ID) remove the statements with the same value.
 * https://www.wikidata.org/w/api.php?action=help&modules=wbeditentity
 */

type Term = { language: string; value: string };
type ClaimData =
  | { id: string; remove: "" }
  | (Omit<Claim, "id"> & { id?: string; type: "statement" });

export interface EntityData {
  labels?: Record<string, Term>;
  descriptions?: Record<string, Term>;
  aliases?: (Term & ({ add: "" } | { remove: "" }))[];
  sitelinks?: Record<
    string,
    { site: string; title: string } | { site: string; title: ""; remove: "" }
  >;
  claims?: ClaimData[];
}

/** Snaks grouped by property, as in claims. */
function byProperty(snaks: Snak[] = []): Record<string, Snak[]> {
  const result: Record<string, Snak[]> = {};
  for (const snak of snaks) (result[snak.property] ??= []).push(snak);
  return result;
}

function statementData(entity: Entity, edit: StatementEdit): ClaimData[] {
  const existing = entity.claims[edit.snak.property] ?? [];
  if (edit.remove) {
    // pasted removals ("-Q42|P31|Q5") match by value
    const ids = edit.claimId.startsWith("new-")
      ? existing
          .filter((c) => snakKey(c.mainsnak) === snakKey(edit.snak))
          .map((c) => c.id)
      : [edit.claimId];
    return ids.map((id) => ({ id, remove: "" }));
  }
  const qualifiers = edit.qualifiers?.length
    ? byProperty(edit.qualifiers)
    : undefined;
  if (edit.original) {
    const claim = existing.find((c) => c.id === edit.claimId);
    if (!claim) throw new Error(`Statement ${edit.claimId} not found`);
    // the whole statement is replaced: keep its references
    const { qualifiers: _, ...rest } = claim;
    return [
      {
        ...rest,
        type: "statement",
        mainsnak: edit.snak,
        ...(qualifiers && { qualifiers }),
      },
    ];
  }
  return [
    {
      type: "statement",
      rank: edit.rank ?? "normal",
      mainsnak: edit.snak,
      ...(qualifiers && { qualifiers }),
      ...(edit.references?.length && {
        references: edit.references.map((snaks) => ({
          snaks: byProperty(snaks),
        })),
      }),
    },
  ];
}

export function toEntityData(entity: Entity, edits: Edit[]): EntityData {
  const data: EntityData = {};
  for (const edit of edits) {
    switch (edit.type) {
      case "label":
      case "description": {
        const terms = edit.type === "label" ? "labels" : "descriptions";
        // empty value removes it
        (data[terms] ??= {})[edit.language] = {
          language: edit.language,
          value: edit.value,
        };
        break;
      }
      case "alias":
        (data.aliases ??= []).push({
          language: edit.language,
          value: edit.value,
          ...(edit.remove ? { remove: "" as const } : { add: "" as const }),
        });
        break;
      case "sitelink":
        (data.sitelinks ??= {})[edit.site] = edit.title
          ? { site: edit.site, title: edit.title }
          : { site: edit.site, title: "", remove: "" };
        break;
      case "statement":
        (data.claims ??= []).push(...statementData(entity, edit));
        break;
    }
  }
  return data;
}

/** The entity after saving the edits, e.g. for a diff of the pending changes. */
export function applyEdits(entity: Entity, edits: Edit[]): Entity {
  const data = toEntityData(entity, edits);
  // a deep copy, also of reactive entities
  const result: Entity = JSON.parse(JSON.stringify(entity));
  for (const terms of ["labels", "descriptions"] as const)
    for (const { language, value } of Object.values(data[terms] ?? {}))
      if (value) result[terms][language] = { value };
      else delete result[terms][language];
  for (const { language, value, ...change } of data.aliases ?? []) {
    const aliases = (result.aliases[language] ?? []).filter(
      (a) => a.value !== value,
    );
    if ("add" in change) aliases.push({ value });
    if (aliases.length) result.aliases[language] = aliases;
    else delete result.aliases[language];
  }
  for (const sitelink of Object.values(data.sitelinks ?? {})) {
    result.sitelinks ??= {};
    if (sitelink.title) result.sitelinks[sitelink.site] = sitelink;
    else delete result.sitelinks[sitelink.site];
  }
  let counter = 0;
  for (const claim of data.claims ?? []) {
    if ("remove" in claim) {
      for (const [property, claims] of Object.entries(result.claims))
        result.claims[property] = claims.filter((c) => c.id !== claim.id);
      continue;
    }
    const { type: _, ...rest } = claim;
    const property = claim.mainsnak.property;
    const claims = (result.claims[property] ??= []);
    const i = claim.id ? claims.findIndex((c) => c.id === claim.id) : -1;
    const updated = { ...rest, id: claim.id ?? `new-${++counter}` };
    if (i >= 0) claims[i] = updated;
    else claims.push(updated);
  }
  return result;
}
