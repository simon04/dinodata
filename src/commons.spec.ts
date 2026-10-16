import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getImageInfo } from "./commons";

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
