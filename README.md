# DinoData

A prototype of [Wikidata](https://www.wikidata.org/) with a nicer UX, built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system.

> 🦕 **Wikimania 2024 Hackathon** — DinoData is named after the dragons in the logo of the [Wikimania 2024 Hackathon](https://wikimania.wikimedia.org/wiki/2024:Hackathon) in Katowice, Poland.
>
> ![Wikimania 2024 dragons](<https://commons.wikimedia.org/wiki/Special:FilePath/Wikimania_2024_Dragons_in_love_illustration_(beige_background).png?width=320>)
>
> Illustration by Kasia Ostrowska (bazgra_nina), Wikimedia Foundation, [CC0](<https://commons.wikimedia.org/wiki/File:Wikimania_2024_Dragons_in_love_illustration_(beige_background).png>)

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

- **Add statements** (property + value) with a keyboard-friendly flow: Enter adds and focuses the next property; add values to existing properties with `+`
- **Change values** of existing statements (pencil or double-click), e.g. a number or a photo. QuickStatements cannot modify values, so this exports `-STATEMENT|<id>` followed by the statement re-added with its qualifiers, references and rank
- **Remove statements** (`-STATEMENT|<id>`) and undo any change
- Value inputs per datatype with validation and a hint for the expected format: items/properties (search), strings, external IDs, URLs, Commons files, dates (`1955`, `1955-05`, `1955-05-15`), quantities (unit kept when editing), coordinates, monolingual text
- Ranks (`R+`/`R-`) and Julian calendar dates (`/J`) preserved in the export
- Inline editing of labels, descriptions and aliases in all languages; add new languages
- Edit, add and remove sitelinks
- Pending additions highlighted green, changes yellow, removals red

### Copy & paste

- Copy one statement or all statements of a property (copy icons on hover / in the property column)
- The clipboard holds human-readable QuickStatements lines — the same format as the export — so copy/paste works across tabs and even different browsers
- Paste with Ctrl+V anywhere on an item page, or with the “Paste statements” button
- Pasting accepts:
  - QuickStatements lines (`Q1|P31|Q5|R+|P580|+2001-00-00T00:00:00Z/9|S854|"…"`); the subject is replaced by the current item, statements repeated with different references are merged
  - label, description, alias and sitelink lines (`Q1|Lde|"…"`, `Q1|Aen|"…"|"…"`, `Q1|Sdewiki|"…"`)
  - simple `P31=Q5` lines
  - Wikidata entity JSON (e.g. from `Special:EntityData/Q42.json`)
- Every value is validated against the property datatype; invalid lines are skipped with a hint, values already present are skipped

### Speed

- All ~14,000 Wikidata properties are preloaded (one SPARQL query) with English and user-language labels, aliases, descriptions, datatypes and formatter URLs
- Property search runs locally in a few milliseconds: by ID (`P31`, `31`), URL (`…/Property:P31`, `…/entity/P31`, `…/prop/direct/P31`), label or alias in English and the user language
- Item renders immediately, value labels stream in progressively
- Local cache: Cache API for properties (24 h, refreshed in the background) and entities (1 h), sessionStorage for labels. Browser refresh bypasses the cache for the current item; refreshing twice within 5 seconds drops all caches.

### Languages

- Searchable language selector over all Wikimedia languages, defaulting to the browser language
- UI translated into English, German, Spanish, French, Chinese, Arabic and Russian (`src/i18n/*.json`, MediaWiki-style `$1` and `{{PLURAL:…}}` with CLDR plural forms)
- Right-to-left layout for Arabic, Hebrew, Persian, Urdu and other RTL languages

## Development

```sh
pnpm install   # also installs the Git pre-commit hook (vp config)
pnpm dev       # development server with hot reload
pnpm build     # type-check (vue-tsc) and build to dist/
pnpm preview   # serve the production build from dist/
pnpm vp check  # format, lint and type checks
pnpm vp fmt    # format all files
pnpm vp lint   # lint only
```

Tooling is [Vite+](https://viteplus.dev/) (`vp`), configured in `vite.config.ts` (`fmt`, `lint`, `staged`). The pre-commit hook (`.vite-hooks/`) runs `vp check --fix` on staged files, so commits are formatted and linted automatically.

CI builds on every push and deploys `master` to GitHub Pages (and Toolforge, if `TOOLFORGE_DEPLOY_TOKEN` is set).

## Deployment

The tool is deployed on [Toolforge](https://wikitech.wikimedia.org/wiki/Help:Toolforge/Deploy_your_tool)
at https://dinodata.toolforge.org/ using the build service. `toolforge.yaml`
declares a single continuous component, built from this repository and published
at `/`; the `web` process in the `Procfile` serves the Vite build output via
`server.js`.

Register the configuration once, then deploy:

```sh
become dinodata
toolforge components config create toolforge.yaml
toolforge components deployment create
```

Pushes to `master` deploy automatically once a deploy token
(`toolforge components deploy-token create`) is stored as the
`TOOLFORGE_DEPLOY_TOKEN` GitHub Actions secret.

## License

[GPL-3.0](LICENSE) © Simon Legner. Data from Wikidata is available under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
