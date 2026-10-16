import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { fakeCaches } from "./testing/fake-caches";
import { getEntities, getLabels, label, searchEntities } from "./wikidata";

/** Fake API: every requested ID gets an English label "label of <id>". */
const fetch = vi.fn(async (input: string | URL) => {
  const url = new URL(input);
  const params = url.searchParams;
  if (params.get("action") === "wbsearchentities")
    return Response.json({
      search: [{ id: "Q1735", label: params.get("search") }],
    });
  const entities = Object.fromEntries(
    params
      .get("ids")!
      .split("|")
      .map((id) => [
        id,
        id === "Q404"
          ? { id, missing: "" }
          : { id, labels: { en: { value: `label of ${id}` } } },
      ]),
  );
  return Response.json({ entities });
});
const params = (call: number) =>
  new URL(fetch.mock.calls[call][0]).searchParams;

beforeEach(() => {
  fetch.mockClear();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", fakeCaches());
});
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("label", () => {
  const entity = {
    labels: { de: { value: "Wien" }, en: { value: "Vienna" } },
  };

  it("prefers the language, then English", () => {
    expect(label(entity, "de")).toBe("Wien");
    expect(label(entity, "fr")).toBe("Vienna");
    expect(label({ labels: {} }, "de")).toBeUndefined();
    expect(label(undefined, "de")).toBeUndefined();
  });
});

describe("searchEntities", () => {
  it("searches in the user language for CORS-enabled JSON", async () => {
    expect(await searchEntities("Innsbruck", "de", "item")).toEqual([
      { id: "Q1735", label: "Innsbruck" },
    ]);
    expect(Object.fromEntries(params(0))).toMatchObject({
      action: "wbsearchentities",
      search: "Innsbruck",
      language: "de",
      uselang: "de",
      type: "item",
      origin: "*",
      format: "json",
    });
  });
});

describe("getEntities", () => {
  it("requests at most 50 IDs at a time and merges the results", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
    const entities = await getEntities(ids, "labels", ["de", "en"]);
    expect(Object.keys(entities)).toHaveLength(120);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(params(2).get("ids")!.split("|")).toHaveLength(20);
    expect(params(0).get("languages")).toBe("de|en");
  });

  it("caches responses unless bypassed", async () => {
    await getEntities(["Q1"]);
    await getEntities(["Q1"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await getEntities(["Q1"], undefined, undefined, true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("getLabels", () => {
  it("streams cached labels first, then fetched ones", async () => {
    sessionStorage.setItem("dinodata:label:de:Q1", "cached");
    const batches: Record<string, string>[] = [];
    await getLabels(["Q1", "Q2"], "de", (batch) => batches.push(batch));
    expect(batches).toEqual([{ Q1: "cached" }, { Q2: "label of Q2" }]);
    expect(params(0).get("ids")).toBe("Q2");
    expect(params(0).get("languages")).toBe("de|en");
    // now cached in the session
    await getLabels(["Q2"], "de", () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the ID when an entity has no label", async () => {
    const onLabels = vi.fn();
    await getLabels(["Q404"], "en", onLabels);
    expect(onLabels).toHaveBeenCalledWith({ Q404: "Q404" });
  });

  it("does not call back without anything cached", async () => {
    const onLabels = vi.fn();
    await getLabels([], "en", onLabels);
    expect(onLabels).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
