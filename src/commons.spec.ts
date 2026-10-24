import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { getCategoryFiles, getFileInfos, getImageInfo } from "./commons";
import { fakeCaches } from "./testing/fake-caches";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getImageInfo", () => {
  it("returns the thumbnail fitting the size, author and license as text", async () => {
    const fetch = vi.fn(async (_url: URL) =>
      Response.json({
        query: {
          pages: [
            {
              imageinfo: [
                {
                  thumburl: "https://upload.wikimedia.org/thumb.jpg",
                  thumbwidth: 1600,
                  thumbheight: 1067,
                  descriptionurl:
                    "https://commons.wikimedia.org/wiki/File:A.jpg",
                  extmetadata: {
                    Artist: { value: 'Jane (<a href="x">User:jane</a>)' },
                    LicenseShortName: { value: "CC BY-SA 4.0" },
                  },
                },
              ],
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await getImageInfo("A.jpg", 1600, 1200)).toEqual({
      url: "https://upload.wikimedia.org/thumb.jpg",
      width: 1600,
      height: 1067,
      descriptionUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
      artist: "Jane (User:jane)",
      license: "CC BY-SA 4.0",
    });
    const params = new URL(fetch.mock.calls[0][0]).searchParams;
    expect(params.get("titles")).toBe("File:A.jpg");
    expect(params.get("iiurlwidth")).toBe("1600");
    expect(params.get("iiurlheight")).toBe("1200");
  });

  it("returns nothing for missing files", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ query: { pages: [{ missing: true }] } }),
    );
    expect(await getImageInfo("Missing.jpg", 100, 100)).toBeUndefined();
  });
});

const fetch = vi.fn(async (input: string | URL) => {
  const params = new URL(input).searchParams;
  if (params.get("list") === "categorymembers")
    return Response.json(
      params.get("cmcontinue")
        ? { query: { categorymembers: [{ title: "File:C.png" }] } }
        : {
            query: {
              categorymembers: [
                { title: "File:A.jpg" },
                { title: "File:B.jpg" },
              ],
            },
            continue: { cmcontinue: "file|C", continue: "-||" },
          },
    );
  return Response.json({
    query: {
      pages: params
        .get("titles")!
        .split("|")
        .map((title) =>
          title === "File:Missing.jpg"
            ? { title, missing: true }
            : {
                title,
                imageinfo: [
                  {
                    thumburl: `https://upload/${title}`,
                    thumbwidth: 320,
                    thumbheight: 240,
                    extmetadata: {
                      Artist: { value: '<a href="#">Simon</a>' },
                      DateTimeOriginal: { value: "2020-02-09" },
                    },
                  },
                ],
              },
        ),
    },
  });
});
const params = (call: number) =>
  new URL(fetch.mock.calls[call][0]).searchParams;

const stubApi = () => {
  fetch.mockClear();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", fakeCaches());
};

describe("getCategoryFiles", () => {
  beforeEach(stubApi);

  it("lists files of the category, then continues", async () => {
    const first = await getCategoryFiles("Axamer Bach");
    expect(first.files).toEqual(["A.jpg", "B.jpg"]);
    expect(Object.fromEntries(params(0))).toMatchObject({
      cmtitle: "Category:Axamer Bach",
      cmtype: "file",
      cmlimit: "500",
    });
    const second = await getCategoryFiles("Axamer Bach", first.next);
    expect(params(1).get("cmcontinue")).toBe("file|C");
    expect(second).toEqual({ files: ["C.png"], next: undefined });
  });
});

describe("getFileInfos", () => {
  beforeEach(stubApi);

  it("fetches thumbnails and metadata in batches of 50", async () => {
    const files = [
      ...Array.from({ length: 60 }, (_, i) => `${i}.jpg`),
      "Missing.jpg",
    ];
    const infos: Record<string, unknown> = {};
    await getFileInfos(files, 320, "de", (batch) =>
      Object.assign(infos, batch),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(params(0).get("titles")!.split("|")).toHaveLength(50);
    expect(params(0).get("iiurlwidth")).toBe("320");
    expect(params(0).get("iiextmetadatalanguage")).toBe("de");
    // missing files are skipped
    expect(Object.keys(infos)).toHaveLength(60);
    expect(infos["0.jpg"]).toEqual({
      url: "https://upload/File:0.jpg",
      width: 320,
      height: 240,
      description: undefined,
      artist: "Simon",
      date: "2020-02-09",
    });
  });
});
