import type { Claim, Snak } from "./wikidata";

/**
 * Statements on the clipboard as plain-text JSON, so copy/paste works across
 * tabs and browsers. Also accepts Wikidata entity JSON and claim arrays.
 */
export interface ClipboardStatements {
  dinodata: 1;
  source?: string;
  claims: Claim[];
  /** labels of referenced entities, so the paste target can show them */
  labels?: Record<string, string>;
}

function snaksOf(claim: Claim): Snak[] {
  return [
    claim.mainsnak,
    ...Object.values(claim.qualifiers ?? {}).flat(),
    ...(claim.references ?? []).flatMap((r) => Object.values(r.snaks).flat()),
  ];
}

export async function copyClaims(
  claims: Claim[],
  source: string,
  labels: Record<string, string>,
): Promise<void> {
  const ids = new Set(
    claims.flatMap(snaksOf).flatMap((snak) => {
      const id = (snak.datavalue?.value as { id?: string } | undefined)?.id;
      return id ? [snak.property, id] : [snak.property];
    }),
  );
  const data: ClipboardStatements = {
    dinodata: 1,
    source,
    // strip IDs and hashes: pasted statements are new statements
    claims: claims.map(({ rank, mainsnak, qualifiers, references }) => ({
      id: "",
      rank,
      mainsnak,
      qualifiers,
      references: references?.map(({ snaks }) => ({ snaks })),
    })),
    labels: Object.fromEntries(
      [...ids].flatMap((id) => (labels[id] ? [[id, labels[id]]] : [])),
    ),
  };
  await navigator.clipboard.writeText(JSON.stringify(data, null, 1));
}

export function parseClaims(
  text: string,
): Pick<ClipboardStatements, "claims" | "labels"> | undefined {
  let json: unknown;
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
    Array.isArray(x)
      ? x.filter(isClaim)
      : typeof x === "object" && x !== null
        ? Object.values(x).flat().filter(isClaim)
        : [];
  const data = json as Partial<ClipboardStatements> & {
    entities?: Record<string, { claims?: unknown }>;
  };
  // DinoData clipboard, Wikidata entity JSON, wbgetentities response, or claims
  const claims = Array.isArray(json)
    ? claimsOf(json)
    : data.entities
      ? Object.values(data.entities).flatMap((e) => claimsOf(e.claims))
      : claimsOf(data.claims);
  return claims.length ? { claims, labels: data.labels } : undefined;
}
