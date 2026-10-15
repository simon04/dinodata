/**
 * Local caching: large responses (properties, entities) in the Cache API,
 * small per-ID labels in sessionStorage.
 *
 * Browser refresh bypasses the cache for the current item; refreshing twice
 * within 5 seconds drops all caches (incl. the preloaded properties).
 */

const PREFIX = "dinodata";
const RELOAD_KEY = `${PREFIX}.lastReload`;
const DOUBLE_RELOAD_MS = 5000;

const navigation = performance.getEntriesByType("navigation")[0] as
  | PerformanceNavigationTiming
  | undefined;

/** The page was loaded via browser refresh. */
export const isReload = navigation?.type === "reload";

const lastReload = Number(sessionStorage.getItem(RELOAD_KEY));
/** Refreshed twice within 5 seconds: drop all caches. */
export const isDoubleReload =
  isReload && Date.now() - lastReload < DOUBLE_RELOAD_MS;
if (isReload) sessionStorage.setItem(RELOAD_KEY, String(Date.now()));

let reloadBypass = isReload;
/** True once after a browser refresh: bypass the cache for the first item. */
export function consumeReloadBypass(): boolean {
  const bypass = reloadBypass;
  reloadBypass = false;
  return bypass;
}

const cleared: Promise<void> = isDoubleReload
  ? clearCaches()
  : Promise.resolve();

export async function clearCaches(): Promise<void> {
  console.info("DinoData: dropping all caches");
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith(`${PREFIX}:`)) sessionStorage.removeItem(key);
  if ("caches" in window)
    for (const name of await caches.keys())
      if (name.startsWith(PREFIX)) await caches.delete(name);
}

const FETCHED = "x-dinodata-fetched";

/**
 * Fetch text via the Cache API. Stale entries are returned immediately and
 * refreshed in the background when `staleWhileRevalidate` is set.
 */
export async function cachedFetch(
  url: string,
  {
    cacheName,
    maxAge,
    bypass = false,
    staleWhileRevalidate = false,
    init,
  }: {
    cacheName: string;
    maxAge: number;
    bypass?: boolean;
    staleWhileRevalidate?: boolean;
    init?: RequestInit;
  },
): Promise<string> {
  await cleared;
  const cache =
    "caches" in window
      ? await caches.open(`${PREFIX}-${cacheName}`)
      : undefined;
  const fresh = async () => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.text();
    await cache?.put(
      url,
      new Response(body, { headers: { [FETCHED]: String(Date.now()) } }),
    );
    return body;
  };
  const cached = bypass ? undefined : await cache?.match(url);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get(FETCHED));
    if (age < maxAge) return cached.text();
    if (staleWhileRevalidate) {
      fresh().catch(console.warn);
      return cached.text();
    }
  }
  return fresh();
}

/** Small key-value cache in sessionStorage. */
export const sessionCache = {
  get(key: string): string | null {
    return sessionStorage.getItem(`${PREFIX}:${key}`);
  },
  set(key: string, value: string): void {
    try {
      sessionStorage.setItem(`${PREFIX}:${key}`, value);
    } catch {
      // quota exceeded: caching is best effort
    }
  },
};
