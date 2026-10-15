# DinoData

A prototype of [Wikidata](https://www.wikidata.org/) with a nicer UX, built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system.

The name comes from the dragons of the [Wikimania 2024](<https://commons.wikimedia.org/wiki/File:Wikimania_2024_Dragons_in_love_illustration_(beige_background).png>) logo — click the 🦕.

## Features

### Viewing

- Open any item via search or URL hash, e.g. `#Q40` (Austria) or `#Q1735` (Innsbruck)
- Header with label, description, aliases, image (P18) and links to Wikidata and Wikipedia
- Tabs for statements, identifiers, languages (labels, descriptions, aliases) and sitelinks
- Compact layout to minimize scrolling: values flow in columns, inline qualifiers, reference badges that expand on click, long value lists collapsed (“49 more”), identifiers and sitelinks in multiple columns
- Ranks (preferred/deprecated), linked values, image thumbnails, OpenStreetMap links for coordinates, formatter URLs (P1630) for identifiers
- Wikidata IDs shown as `<code>` after every link — click to copy
- Numbers, dates and coordinates formatted for the selected language
- Document title `Q40 · Austria · DinoData`
- Loading skeleton animation, dark mode (follows the system setting)

### Editing

Edits are collected locally and exported as [QuickStatements 3.0](https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation/User_guide) commands to copy; nothing is written to Wikidata directly (yet).

- Add statements (property + value) with keyboard-friendly flow: Enter adds and focuses the next property
- Add values to existing properties, remove statements (exported as `-STATEMENT|<id>`), undo any change
- Value inputs per datatype: items/properties (search), strings, external IDs, URLs, Commons files, dates (`1955`, `1955-05`, `1955-05-15`), quantities, coordinates, monolingual text
- Inline editing of labels, descriptions and aliases in all languages; add new languages
- Edit, add and remove sitelinks
- Pending additions highlighted green, removals red

### Speed

- All ~14,000 Wikidata properties are preloaded (one SPARQL query) with English and user-language labels, aliases, descriptions, datatypes and formatter URLs
- Property search runs locally in a few milliseconds: by ID (`P31`, `31`), URL (`…/Property:P31`, `…/entity/P31`, `…/prop/direct/P31`), label or alias in English and the user language
- Item renders immediately, value labels stream in progressively
- Local cache: Cache API for properties (24 h, refreshed in the background) and entities (1 h), sessionStorage for labels. Browser refresh bypasses the cache for the current item; refreshing twice within 5 seconds drops all caches.

### Languages

- Searchable language selector over all Wikimedia languages, defaulting to the browser language
- Translatable UI (`src/i18n/*.json`, MediaWiki-style `$1` and `{{PLURAL:…}}`); English and German available

## Development

```sh
pnpm install
pnpm dev
```

`pnpm build` type-checks and builds to `dist/`. CI builds on every push and deploys `master` to GitHub Pages (and Toolforge, if `TOOLFORGE_DEPLOY_TOKEN` is set).

## License

GPL-3.0
