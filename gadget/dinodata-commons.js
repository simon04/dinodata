/**
 * DinoData link for Wikimedia Commons: adds a "DinoData" tab right of "Read"
 * on file pages, opening their structured data (MediaInfo, e.g. M119963151),
 * and on pages connected to a Wikidata item (categories, galleries, creators),
 * opening that item (e.g. Q105337024).
 *
 * Install as user script on commons.wikimedia.org (User:Simon04/DinoData.js)
 * or as gadget (MediaWiki:Gadget-DinoData.js, dependencies: mediawiki.util).
 *
 * Category: [[:Category:DinoData]]
 * Source: https://github.com/simon04/dinodata/blob/master/gadget/dinodata-commons.js
 */
mw.loader.using("mediawiki.util").then(() => {
  let id;
  if (mw.config.get("wgNamespaceNumber") === 6) {
    // file: its MediaInfo ID, `M` + page ID (also without structured data yet)
    const pageId = mw.config.get("wgArticleId");
    if (pageId) id = `M${pageId}`;
  } else {
    // category, gallery, creator…: the connected Wikidata item
    id = mw.config.get("wgWikibaseItemId");
  }
  if (!id) return;
  const link = mw.util.addPortletLink(
    "p-views",
    `https://dinodata.toolforge.org/#${id}`,
    "DinoData",
    "ca-dinodata",
    `Open ${id} in DinoData`,
    null,
    "#ca-history",
  );
  // Vector 2022: move into the "More" menu on narrow screens like the other tabs
  link?.classList.add("vector-menu-item--collapsible", "vector-tab-noicon");
});
