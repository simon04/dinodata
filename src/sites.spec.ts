import { describe, expect, it } from "vite-plus/test";
import { parseSites, searchSites } from "./sites";

const matrix = {
  count: 3,
  "0": {
    localname: "German",
    site: [
      {
        dbname: "dewiki",
        url: "https://de.wikipedia.org",
        sitename: "Wikipedia",
      },
      {
        dbname: "dewikivoyage",
        url: "https://de.wikivoyage.org",
        sitename: "Wikivoyage",
      },
    ],
  },
  "1": {
    localname: "Dutch",
    site: [
      {
        dbname: "nlwiki",
        url: "https://nl.wikipedia.org",
        sitename: "Wikipedia",
      },
    ],
  },
  specials: [
    {
      dbname: "commonswiki",
      url: "https://commons.wikimedia.org",
      sitename: "Wikimedia Commons",
    },
    {
      dbname: "nlwikimedia",
      url: "https://nl.wikimedia.org",
      sitename: "Wikimedia Nederland",
    },
  ],
};

describe("parseSites", () => {
  it("keeps only linkable sites, named by language and project", () => {
    const sites = parseSites(
      ["commonswiki", "dewiki", "dewikivoyage", "nlwiki", "newwiki"],
      matrix,
    );
    expect([...sites.keys()]).toEqual([
      "commonswiki",
      "dewiki",
      "dewikivoyage",
      "nlwiki",
      "newwiki",
    ]);
    expect(sites.get("dewiki")).toEqual({
      id: "dewiki",
      url: "https://de.wikipedia.org",
      name: "German Wikipedia",
    });
    expect(sites.get("commonswiki")?.name).toBe("Wikimedia Commons");
    // not in the site matrix (yet)
    expect(sites.get("newwiki")).toEqual({
      id: "newwiki",
      url: "",
      name: "newwiki",
    });
    // a chapter wiki, not linkable
    expect(sites.has("nlwikimedia")).toBe(false);
  });
});

describe("searchSites", () => {
  const sites = [
    ...parseSites(
      ["commonswiki", "dewiki", "dewikivoyage", "nlwiki"],
      matrix,
    ).values(),
  ];
  const ids = (q: string) => searchSites(sites, q).map((s) => s.id);

  it("ranks ID prefixes before names", () => {
    expect(ids("de")).toEqual(["dewiki", "dewikivoyage"]);
    expect(ids("dewikiv")).toEqual(["dewikivoyage"]);
  });

  it("finds sites by language or project name and host", () => {
    expect(ids("dutch")).toEqual(["nlwiki"]);
    expect(ids("voyage")).toEqual(["dewikivoyage"]);
    expect(ids("commons")).toEqual(["commonswiki"]);
    expect(ids("de.wikipedia")).toEqual(["dewiki"]);
  });

  it("ignores empty queries", () => {
    expect(searchSites(sites, " ")).toEqual([]);
  });
});
