import { FORMAT_EXAMPLES, parseValue } from "./values";
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

/**
 * Parse lines like `P31=Q5`, `P569 = 1952-03-11` or `P1082=8572895`,
 * validating each value against the property's datatype.
 * Returns undefined if the text is not in this format at all.
 */
export function parsePropertyValues(
  text: string,
  properties: Record<string, { datatype: string }>,
  language: string,
): { claims: Claim[]; invalid: string[] } | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const pattern = /^(P\d+)\s*=\s*(.+)$/i;
  if (!lines.some((line) => pattern.test(line))) return undefined;
  const claims: Claim[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    const m = line.match(pattern);
    const property = m?.[1].toUpperCase();
    const datatype = property && properties[property]?.datatype;
    const datavalue = datatype
      ? parseValue(datatype, m?.[2] ?? "", language)
      : undefined;
    if (!property || !datatype || !datavalue) {
      const example = datatype && FORMAT_EXAMPLES[datatype];
      invalid.push(example ? `${line} (${property}=${example})` : line);
      continue;
    }
    claims.push({
      id: "",
      rank: "normal",
      mainsnak: { snaktype: "value", property, datatype, datavalue },
    });
  }
  return { claims, invalid };
}
