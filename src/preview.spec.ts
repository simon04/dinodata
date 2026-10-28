import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { fetchPreview, previewTarget } from "./preview";
import { fakeCaches } from "./testing/fake-caches";

const entity = (
  sitelinks: Record<string, { site: string; title: string }>,
) => ({
  entities: {
    Q3335: {
      id: "Q3335",
      labels: { de: { value: "George Orwell" } },
      descriptions: { en: { value: "British writer" } },
      sitelinks,
    },
  },
});

let responses: Record<string, unknown>;
const fetch = vi.fn(async (url: string | URL) => {
  const u = new URL(url);
  const key = u.searchParams.get("action") ?? u.host + u.pathname;
  return key in responses
    ? Response.json(responses[key])
    : new Response("", { status: 404 });
});

beforeEach(() => {
  vi.stubGlobal("caches", fakeCaches());
  vi.stubGlobal("fetch", fetch);
  fetch.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPreview", () => {
  it("shows the Wikipedia lead and image in the user language", async () => {
    responses = {
      wbgetentities: entity({
        dewiki: { site: "dewiki", title: "George Orwell" },
        enwiki: { site: "enwiki", title: "George Orwell" },
      }),
      "de.wikipedia.org/api/rest_v1/page/summary/George_Orwell": {
        extract: "Eric Arthur Blair war ein englischer Schriftsteller.",
        lang: "de",
        dir: "ltr",
        thumbnail: {
          source: "https://upload/orwell.jpg",
          width: 220,
          height: 300,
        },
      },
    };
    expect(await fetchPreview("Q3335", "de")).toEqual({
      id: "Q3335",
      label: "George Orwell",
      description: "British writer",
      extract: {
        text: "Eric Arthur Blair war ein englischer Schriftsteller.",
        lang: "de",
        dir: "ltr",
      },
      image: { url: "https://upload/orwell.jpg", width: 220, height: 300 },
    });
    const query = new URL(fetch.mock.calls[0][0]).searchParams;
    expect(query.get("sitefilter")).toBe("dewiki|enwiki");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to English Wikipedia, then to the item's image (P18)", async () => {
    responses = {
      wbgetentities: entity({
        enwiki: { site: "enwiki", title: "George Orwell" },
      }),
      "en.wikipedia.org/api/rest_v1/page/summary/George_Orwell": {
        extract: "Eric Arthur Blair was an English novelist.",
        lang: "en",
        dir: "ltr",
      },
      wbgetclaims: {
        claims: { P18: [{ mainsnak: { datavalue: { value: "Orwell.jpg" } } }] },
      },
      query: {
        query: {
          pages: [
            {
              imageinfo: [
                {
                  thumburl: "https://upload/thumb.jpg",
                  thumbwidth: 320,
                  thumbheight: 200,
                  descriptionurl: "",
                },
              ],
            },
          ],
        },
      },
    };
    const preview = await fetchPreview("Q3335", "de");
    expect(preview.extract?.lang).toBe("en");
    expect(preview.image).toEqual({
      url: "https://upload/thumb.jpg",
      width: 320,
      height: 200,
    });
  });

  it("shows label and description without any article or image", async () => {
    responses = { wbgetentities: entity({}), wbgetclaims: {} };
    expect(await fetchPreview("Q3335", "de")).toEqual({
      id: "Q3335",
      label: "George Orwell",
      description: "British writer",
      extract: undefined,
      image: undefined,
    });
  });
});

describe("previewTarget", () => {
  const link = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.innerHTML = "<span>label</span>";
    document.body.append(a);
    return a;
  };

  it("finds the item link around the target", () => {
    const a = link("#Q42");
    expect(previewTarget(a.firstChild)).toEqual({ link: a, id: "Q42" });
  });

  it("ignores properties, comparisons and external links", () => {
    for (const href of ["#P31", "#Q42/Q64", "https://example.org/#Q42"])
      expect(previewTarget(link(href))).toBeUndefined();
  });
});
