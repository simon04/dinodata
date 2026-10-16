import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { cachedFetch, clearCaches, sessionCache } from "./cache";
import { fakeCaches } from "./testing/fake-caches";

let caches: ReturnType<typeof fakeCaches>;
const fetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  caches = fakeCaches();
  vi.stubGlobal("caches", caches);
  vi.stubGlobal("fetch", fetch);
  fetch.mockReset();
  let n = 0;
  fetch.mockImplementation(async () => new Response(`body ${++n}`));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const options = { cacheName: "test", maxAge: 1000 };

describe("cachedFetch", () => {
  it("returns cached responses until they expire", async () => {
    expect(await cachedFetch("https://x/1", options)).toBe("body 1");
    vi.setSystemTime(999);
    expect(await cachedFetch("https://x/1", options)).toBe("body 1");
    vi.setSystemTime(1000);
    expect(await cachedFetch("https://x/1", options)).toBe("body 2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache on request but stores the fresh response", async () => {
    await cachedFetch("https://x/1", options);
    expect(await cachedFetch("https://x/1", { ...options, bypass: true })).toBe(
      "body 2",
    );
    expect(await cachedFetch("https://x/1", options)).toBe("body 2");
  });

  it("serves stale responses while revalidating in the background", async () => {
    const swr = { ...options, staleWhileRevalidate: true };
    await cachedFetch("https://x/1", swr);
    vi.setSystemTime(5000);
    expect(await cachedFetch("https://x/1", swr)).toBe("body 1");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () =>
      expect(await cachedFetch("https://x/1", swr)).toBe("body 2"),
    );
  });

  it("keeps separate caches per name and passes request options", async () => {
    const init = { headers: { Accept: "text/tab-separated-values" } };
    await cachedFetch("https://x/1", { ...options, init });
    await cachedFetch("https://x/1", { ...options, cacheName: "other" });
    expect(fetch).toHaveBeenNthCalledWith(1, "https://x/1", init);
    expect([...caches.stores.keys()]).toEqual([
      "dinodata-test",
      "dinodata-other",
    ]);
  });

  it("throws on HTTP errors without caching them", async () => {
    fetch.mockResolvedValueOnce(
      new Response("nope", { status: 429, statusText: "Too Many Requests" }),
    );
    await expect(cachedFetch("https://x/1", options)).rejects.toThrow(
      "429 Too Many Requests",
    );
    expect(await cachedFetch("https://x/1", options)).toBe("body 1");
  });
});

describe("clearCaches", () => {
  it("drops only DinoData caches and session entries", async () => {
    await caches.open("dinodata-api");
    await caches.open("someone-else");
    sessionCache.set("label:en:Q1", "universe");
    sessionStorage.setItem("other", "kept");
    vi.spyOn(console, "info").mockImplementation(() => {});
    await clearCaches();
    expect(await caches.keys()).toEqual(["someone-else"]);
    expect(sessionCache.get("label:en:Q1")).toBeNull();
    expect(sessionStorage.getItem("other")).toBe("kept");
  });
});

describe("sessionCache", () => {
  it("stores values with a prefix", () => {
    sessionCache.set("a", "1");
    expect(sessionCache.get("a")).toBe("1");
    expect(sessionStorage.getItem("dinodata:a")).toBe("1");
    expect(sessionCache.get("missing")).toBeNull();
  });

  it("ignores a full storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => sessionCache.set("a", "1")).not.toThrow();
  });
});
