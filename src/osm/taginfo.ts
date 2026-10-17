import { cachedFetch } from "../cache";

/**
 * Usage statistics from taginfo: common values of a key, key suggestions.
 * https://taginfo.openstreetmap.org/taginfo/apidoc
 */

const API = "https://taginfo.openstreetmap.org/api/4";
const MAX_AGE = 24 * 60 * 60 * 1000;

export interface ValueStat {
  value: string;
  count: number;
  /** from the wiki, in the requested language if available */
  description?: string;
}

export interface KeyStat {
  key: string;
  count: number;
}

async function get<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams({
    page: "1",
    rp: "25",
    sortorder: "desc",
    ...params,
  }).toString();
  const text = await cachedFetch(url.toString(), {
    cacheName: "taginfo",
    maxAge: MAX_AGE,
  });
  return (JSON.parse(text) as { data: T[] }).data;
}

/** Most used values of a key. */
export async function getValues(
  key: string,
  language: string,
): Promise<ValueStat[]> {
  const data = await get<{
    value: string;
    count: number;
    description?: string;
  }>("key/values", { key, sortname: "count_all", lang: language });
  return data.map(({ value, count, description }) => ({
    value,
    count,
    description: description || undefined,
  }));
}

/** Keys containing the query, most used first. */
export async function searchKeys(query: string): Promise<KeyStat[]> {
  const data = await get<{ key: string; count_all: number }>("keys/all", {
    query,
    sortname: "count_all",
    rp: "15",
  });
  return data.map(({ key, count_all }) => ({ key, count: count_all }));
}
