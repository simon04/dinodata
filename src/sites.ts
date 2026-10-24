import { cachedFetch } from "./cache";

const API = "https://www.wikidata.org/w/api.php";
const MAX_AGE = 24 * 60 * 60 * 1000;

/** A wiki that items can link to via sitelinks. */
export interface Site {
  /** global site ID, e.g. dewiki */
  id: string;
  /** e.g. https://de.wikipedia.org */
  url: string;
  /** e.g. German Wikipedia */
  name: string;
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  return JSON.parse(
    await cachedFetch(`${API}?${query}`, {
      cacheName: "sites",
      maxAge: MAX_AGE,
      staleWhileRevalidate: true,
    }),
  );
}

interface MatrixSite {
  dbname: string;
  url: string;
  sitename: string;
}
type Matrix = Record<
  string,
  | { localname?: string; site?: MatrixSite[] }
  | (MatrixSite & { lang?: string })[]
  | number
>;

/** Site IDs accepted for sitelinks, named and located by the site matrix. */
export function parseSites(
  linkable: string[],
  matrix: Matrix,
): Map<string, Site> {
  const known = new Map<string, Site>();
  for (const [key, value] of Object.entries(matrix)) {
    if (key === "count" || typeof value === "number") continue;
    if (Array.isArray(value)) {
      // specials: Commons, Wikispecies, Meta, …
      for (const s of value)
        known.set(s.dbname, { id: s.dbname, url: s.url, name: s.sitename });
    } else {
      for (const s of value.site ?? [])
        known.set(s.dbname, {
          id: s.dbname,
          url: s.url,
          name: value.localname
            ? `${value.localname} ${s.sitename}`
            : s.sitename,
        });
    }
  }
  return new Map(
    linkable.map((id) => [id, known.get(id) ?? { id, url: "", name: id }]),
  );
}

let sites: Promise<Map<string, Site>> | undefined;

/** All sites for sitelinks by ID, loaded once (and cached for a day). */
export function getSites(): Promise<Map<string, Site>> {
  sites ??= Promise.all([
    get<{
      paraminfo: {
        modules: { parameters: { name: string; type: unknown }[] }[];
      };
    }>({ action: "paraminfo", modules: "wbsetsitelink" }),
    get<{ sitematrix: Matrix }>({
      action: "sitematrix",
      smsiteprop: "dbname|url|sitename",
      smlangprop: "localname|site",
    }),
  ])
    .then(([info, { sitematrix }]) => {
      const type = info.paraminfo.modules[0].parameters.find(
        (p) => p.name === "linksite",
      )?.type;
      return parseSites(Array.isArray(type) ? type : [], sitematrix);
    })
    .catch((e) => {
      sites = undefined;
      throw e;
    });
  return sites;
}

/** Sites matching the query: by ID first, then by name. */
export function searchSites(
  sites: Iterable<Site>,
  query: string,
  limit = 20,
): Site[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (s: Site) => {
    const name = s.name.toLowerCase();
    if (s.id === q) return 0;
    if (s.id.startsWith(q)) return 1;
    if (name.startsWith(q)) return 2;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 3;
    if (s.id.includes(q) || name.includes(q) || s.url.includes(q)) return 4;
    return 5;
  };
  return [...sites]
    .map((s) => [rank(s), s] as const)
    .filter(([r]) => r < 5)
    .sort((a, b) => a[0] - b[0] || a[1].id.localeCompare(b[1].id))
    .slice(0, limit)
    .map(([, s]) => s);
}
