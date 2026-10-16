import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError, apiPost, editEntity } from "./wikidata";

const auth = { accessToken: "secret", username: "Simon04" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(...responses: object[]) {
  const fetch = vi.fn(
    async (_url: URL, _init: RequestInit) =>
      new Response(JSON.stringify(responses.shift()), {
        headers: { "retry-after": "1" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const body = (init: RequestInit) => init.body as URLSearchParams;

describe("apiPost", () => {
  it("posts authenticated with crossorigin and assertuser", async () => {
    const fetch = stubFetch({ query: {} });
    expect(await apiPost({ action: "query" }, auth)).toEqual({ query: {} });
    const [url, init] = fetch.mock.calls[0];
    expect(url.searchParams.has("crossorigin")).toBe(true);
    expect(url.searchParams.has("origin")).toBe(false);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer secret" });
    expect(body(init).get("assertuser")).toBe("Simon04");
    expect(body(init).get("maxlag")).toBe("5");
  });

  it("throws API errors with their code", async () => {
    stubFetch({ errors: [{ code: "editconflict", text: "Edit conflict." }] });
    const error = await apiPost({ action: "wbeditentity" }, auth).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "editconflict",
      message: "Edit conflict.",
    });
  });

  it("retries on maxlag after Retry-After", async () => {
    vi.useFakeTimers();
    const fetch = stubFetch(
      { errors: [{ code: "maxlag", text: "Waiting" }] },
      { ok: true },
    );
    const result = apiPost({ action: "query" }, auth);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("editEntity", () => {
  it("edits with a CSRF token and the base revision", async () => {
    const fetch = stubFetch(
      { query: { tokens: { csrftoken: "token+\\" } } },
      { entity: { lastrevid: 43 } },
    );
    const result = await editEntity(
      "Q42",
      { labels: { en: { language: "en", value: "x" } } },
      { baserevid: 42, summary: "test", auth },
    );
    expect(result).toEqual({ lastrevid: 43 });
    const edit = body(fetch.mock.calls[1][1]);
    expect(edit.get("action")).toBe("wbeditentity");
    expect(edit.get("id")).toBe("Q42");
    expect(edit.get("baserevid")).toBe("42");
    expect(edit.get("token")).toBe("token+\\");
    expect(JSON.parse(edit.get("data")!)).toEqual({
      labels: { en: { language: "en", value: "x" } },
    });
  });
});
