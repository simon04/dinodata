/**
 * DinoData link for Wikidata: adds a "DinoData" tab right of "Read" on
 * item, property and lexeme pages, opening the entity in DinoData.
 *
 * Install as user script on wikidata.org (User:Simon04/DinoData.js) or as
 * gadget (MediaWiki:Gadget-DinoData.js, dependencies: mediawiki.util).
 *
 * Wikidata item: [[d:Q141903666]]
 * Source: https://github.com/simon04/dinodata/blob/master/gadget/dinodata.js
 */
mw.loader.using("mediawiki.util").then(() => {
  const id = mw.config.get("wbEntityId");
  if (!id || !/^[LPQ]\d+$/.test(id)) return;
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
