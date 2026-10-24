import { cachedFetch } from "./cache";
import { claimToEdit } from "./clipboard";
import { quote, toQuickStatements } from "./quickstatements";
import type { Entity } from "./wikidata";

const API = "https://www.wikidata.org/w/api.php";

async function get<T>(
  params: Record<string, string>,
  cache?: { cacheName: string; maxAge: number },
): Promise<T> {
  const url = `${API}?${new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  })}`;
  if (cache) return JSON.parse(await cachedFetch(url, cache));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface Revision {
  revid: number;
  /** 0 for the creation of the page */
  parentid: number;
  /** missing if hidden */
  user?: string;
  /** IP edit */
  anon?: boolean;
  timestamp: string;
  comment?: string;
  tags: string[];
  /** the entity after this revision, missing if hidden */
  entity?: Entity;
}

interface RevisionPage {
  revisions?: (Omit<Revision, "entity"> & {
    slots?: { main?: { content?: string } };
  })[];
}

/** The entity JSON of a revision; redirects and hidden content as none. */
function parseContent(content?: string): Entity | undefined {
  try {
    const entity = content ? JSON.parse(content) : undefined;
    return entity?.id ? entity : undefined;
  } catch {
    return undefined;
  }
}

const toRevision = ({
  slots,
  ...rev
}: NonNullable<RevisionPage["revisions"]>[number]): Revision => ({
  ...rev,
  tags: rev.tags ?? [],
  entity: parseContent(slots?.main?.content),
});

/** Revisions of an entity page with its content, newest first, 20 per request. */
export async function getRevisions(
  title: string,
  from?: Record<string, string>,
): Promise<{ revisions: Revision[]; next?: Record<string, string> }> {
  const json = await get<{
    query?: { pages: RevisionPage[] };
    continue?: Record<string, string>;
  }>({
    action: "query",
    prop: "revisions",
    titles: title,
    rvprop: "ids|timestamp|user|tags|comment|content",
    rvslots: "main",
    rvlimit: "20",
    ...from,
  });
  return {
    revisions: (json.query?.pages[0]?.revisions ?? []).map(toRevision),
    next: json.continue,
  };
}

/** The entity of a single revision; revisions do not change, cached for a month. */
export async function getRevisionEntity(
  revid: number,
): Promise<Entity | undefined> {
  const json = await get<{ query?: { pages: RevisionPage[] } }>(
    {
      action: "query",
      prop: "revisions",
      revids: String(revid),
      rvprop: "ids|content",
      rvslots: "main",
    },
    { cacheName: "history", maxAge: 30 * 24 * 60 * 60 * 1000 },
  );
  const rev = json.query?.pages[0]?.revisions?.[0];
  return rev && toRevision({ ...rev, tags: [] }).entity;
}

/** A line of a diff: QuickStatements added (+) or removed (-). */
export interface DiffLine {
  type: "+" | "-";
  text: string;
}

/** Lines of `a` not in `b`, as multisets: duplicate statements count. */
const minus = (a: string[], b: string[]) => {
  const rest = new Map<string, number>();
  for (const x of b) rest.set(x, (rest.get(x) ?? 0) + 1);
  return a.filter((x) => {
    const n = rest.get(x) ?? 0;
    if (n) rest.set(x, n - 1);
    return !n;
  });
};

/**
 * The changes between two versions of an entity as QuickStatements lines:
 * terms, statements (with qualifiers and references) and sitelinks; a
 * changed statement is removed and added.
 */
export function entityDiff(
  before: Entity | undefined,
  after: Entity | undefined,
): DiffLine[] {
  const id = after?.id ?? before?.id ?? "";
  const lines = (e: Entity | undefined): string[] => {
    if (!e) return [];
    const terms = (
      kind: string,
      values: Record<string, { value: string }> | undefined,
    ) =>
      Object.entries(values ?? {}).map(
        ([language, { value }]) => `${id}|${kind}${language}|${quote(value)}`,
      );
    return [
      ...terms("L", e.labels),
      ...terms("D", e.descriptions),
      ...Object.entries(e.aliases ?? {}).flatMap(([language, aliases]) =>
        aliases.map((a) => `${id}|A${language}|${quote(a.value)}`),
      ),
      ...Object.values(e.claims ?? {})
        .flat()
        .flatMap((claim) =>
          toQuickStatements(id, [claimToEdit(claim, claim.id)]).split("\n"),
        ),
      ...Object.values(e.sitelinks ?? {}).map(
        (s) => `${id}|S${s.site}|${quote(s.title)}`,
      ),
    ];
  };
  const old = lines(before);
  const now = lines(after);
  return [
    ...minus(old, now).map((text) => ({ type: "-" as const, text })),
    ...minus(now, old).map((text) => ({ type: "+" as const, text })),
  ];
}

/** Parts of a QuickStatements line, with the entity IDs to link. */
export function tokenize(line: string): { text: string; id?: string }[] {
  const parts: { text: string; id?: string }[] = [];
  // quoted strings stay as they are, IDs (S/U: reference property, unit)
  const pattern = /("(?:[^"\\]|\\.)*")|\b([LPQ]\d+)\b|\b(S)(\d+)\b|(U)(\d+)\b/g;
  let last = 0;
  for (const m of line.matchAll(pattern)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index) });
    if (m[1]) parts.push({ text: m[1] });
    else if (m[2]) parts.push({ text: m[2], id: m[2] });
    else if (m[3]) parts.push({ text: m[0], id: `P${m[4]}` });
    else parts.push({ text: m[0], id: `Q${m[6]}` });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}

/** Display names of change tags, e.g. `OAuth CID: 19784` → `DinoData`. */
export async function getTagNames(
  tags: string[],
  language: string,
): Promise<Record<string, string>> {
  if (!tags.length) return {};
  const json = await get<{
    query: { allmessages: { name: string; content?: string }[] };
  }>(
    {
      action: "query",
      meta: "allmessages",
      ammessages: tags.map((tag) => `tag-${tag}`).join("|"),
      amlang: language,
    },
    { cacheName: "history", maxAge: 24 * 60 * 60 * 1000 },
  );
  const names: Record<string, string> = {};
  for (const m of json.query.allmessages) {
    const tag = m.name.replace(/^tag-/, "");
    // messages may contain wikitext entities like &#91;
    const name = m.content
      ? new DOMParser().parseFromString(m.content, "text/html").body.textContent
      : undefined;
    if (name && name !== "-") names[tag] = name;
  }
  return names;
}
