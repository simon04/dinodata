# DinoData

A prototype of [Wikidata](https://www.wikidata.org/) with a nicer UX, built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system.

> 🦕 **Wikimania 2024 Hackathon** — DinoData is named after the dragons in the logo of the [Wikimania 2024 Hackathon](https://wikimania.wikimedia.org/wiki/2024:Hackathon) in Katowice, Poland.
>
> ![Wikimania 2024 dragons](<https://commons.wikimedia.org/wiki/Special:FilePath/Wikimania_2024_Dragons_in_love_illustration_(beige_background).png?width=320>)
>
> Illustration by Kasia Ostrowska (bazgra_nina), Wikimedia Foundation, [CC0](<https://commons.wikimedia.org/wiki/File:Wikimania_2024_Dragons_in_love_illustration_(beige_background).png>)

## Features

### Viewing

- Open any item via search or URL hash, e.g. `#Q40` (Austria) or `#Q1735` (Innsbruck); the home page lists examples with their label and description in the selected language
- Search results show the ID as a code chip next to the label
- Header with label, description, aliases, image (P18) and buttons to Wikidata, Wikipedia and Wikimedia Commons (Commons category P373, or the Commons sitelink)
- Tabs for statements, identifiers, languages (labels, descriptions, aliases), sitelinks and “What links here” (items, properties and other pages linking to the item, sorted by label)
- Compact layout to minimize scrolling: values flow in columns, inline qualifiers, reference badges that expand on click, long value lists collapsed (“49 more”), sitelinks in multiple columns
- Statement groups ordered by the “properties for this type” (P1963) of the item’s classes (P31); missing ones are suggested for adding
- Values sorted by rank (preferred first, deprecated last), then by point in time (P585) or publication date (P577), newest first
- Descriptions of properties and linked items as tooltips
- Ranks (preferred/deprecated), linked values, image thumbnails (click to enlarge, with author and license), OpenStreetMap links for coordinates, formatter URLs (P1630) for identifiers
- Wikidata IDs shown as `<code>` after every link — click to copy
- Numbers, dates and coordinates formatted for the selected language
- Document title `Q40 · Austria · DinoData`
- Loading skeleton animation, dark mode (follows the system setting)

### Editing

Edits are collected locally, then saved to Wikidata directly (after logging in) or exported as [QuickStatements 3.0](https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation/User_guide) commands to copy.

- **Add statements** (property + value) with a keyboard-friendly flow: Enter adds and focuses the next property; add values to existing properties with `+`
- **Change values** of existing statements (pencil or double-click), e.g. a number or a photo, exported as `SWITCH_VALUE`, which keeps the statement with its ID, qualifiers, references and rank
- **Edit qualifiers**: add, change (pencil or double-click) and remove qualifiers of a statement; only the difference is exported: added qualifiers on a line matching the existing statement (QuickStatements merges them), removed ones as `REMOVE_QUAL`
- **Remove statements** (`-STATEMENT|<id>`) and undo any change
- Value inputs per datatype with validation and a hint for the expected format: items/properties (search), strings, external IDs, URLs, Commons files, dates (`1955`, `1955-05`, `1955-05-15`), quantities (unit picked from chips of the property's allowed units or searched; bounds kept when editing), coordinates (globe and precision kept when editing), monolingual text
- Ranks (`R+`/`R-`) and Julian calendar dates (`/J`) preserved in the export
- Inline editing of labels, descriptions and aliases in all languages; add new languages
- Edit, add and remove sitelinks
- Suggested properties (P1963) that the item lacks, one click to add a value
- Pending additions highlighted green, changes yellow, removals red
- Actions appear on hover right after the value (fading in); always visible on touch devices

#### Datatypes

How values of each [datatype](https://www.wikidata.org/wiki/Special:ListDatatypes) can be added and changed, for statements and qualifiers alike:

| Datatype                                            | Add | Change | Notes                                                                                                                                       |
| --------------------------------------------------- | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `wikibase-item`, `wikibase-property`                | ✅  | ✅     | search                                                                                                                                      |
| `wikibase-lexeme`                                   | ✅  | ✅     | ID or URL (`L123`), no search                                                                                                               |
| `wikibase-form`, `wikibase-sense`, `entity-schema`  | ❌  | ❌     | sent as a string, rejected by Wikidata                                                                                                      |
| `quantity`                                          | ✅  | ✅     | `42`, `1.5`; unit from chips of the allowed units (P2302), or search; no ± bounds or exponents when adding; changing moves the bounds along |
| `time`                                              | ✅  | ✅     | `1955`, `1955-05`, `1955-05-15`, other precisions as `+1950-00-00T00:00:00Z/8`; no time of day; changing keeps the calendar                 |
| `globe-coordinate`                                  | ✅  | ✅     | `48.2, 16.37`; new values on Earth with precision 0.0001; changing keeps the globe and precision                                            |
| `monolingualtext`                                   | ✅  | ✅     | text and language code                                                                                                                      |
| `url`                                               | ✅  | ✅     | must start with `scheme://`                                                                                                                 |
| `string`, `external-id`, `math`, `musical-notation` | ✅  | ✅     | not validated before saving                                                                                                                 |
| `commonsMedia`, `geo-shape`, `tabular-data`         | ⚠️  | ⚠️     | file name not checked before saving (no `File:` prefix; `Data:….map` / `Data:….tab`)                                                        |
| unknown value, no value                             | ❌  | ❌     | shown, but not editable                                                                                                                     |

### Saving

- Log in with your Wikimedia account (OAuth 2.0 in a popup, so pending edits are kept); only on https://dinodata.toolforge.org/, where the registered callback is served
- “Save to Wikidata” saves all pending edits of the item in one revision (`wbeditentity`), with an optional edit summary, then reloads the item and links to the diff; edits are tagged with the OAuth consumer “DinoData”
- Changed statements keep their ID, rank and references; removed ones are removed by ID
- Edit conflicts are detected (`baserevid`) instead of overwriting changes made meanwhile
- Runs entirely in the browser: public OAuth client with PKCE, the token is kept in sessionStorage and renewed with the refresh token

### OpenStreetMap tag editor

A second mode at `#osm` edits the tags of OpenStreetMap nodes, ways and relations (no geometry), designed for phones first. See [the concept](docs/osm-concept.md).

- Open objects by URL (openstreetmap.org, iD, JOSM remote control), short ID (`w123`, `way 123`) or route `#osm/way/123`; search places with Photon while typing and Nominatim on Enter; “Near me” lists tagged objects around your location (Overpass); recently opened objects on the OSM home page
- What the object is (“Cafe”) with icon, from the presets of the [iD tagging schema](https://github.com/openstreetmap/id-tagging-schema), translated; tap to change the type
- Fields of the preset with the matching input: yes/no and radio chips, a value picker with translated options and the most used values from taginfo, multi-value chips (`cuisine=pizza;pasta`), `diet:*`-style toggles, names per language, address, access, Wikidata search, phone/URL/number keyboards
- Every tag explained from the Wikibase of the OSM wiki: description in your language, status, image, wiki page, Wikidata concept; deprecated tags marked
- Issues with one-tap fixes: deprecated tags (schema and wiki), values not matching the wiki's format, tags not meant for the element type, incompatible tags
- Add fields or tags (key suggestions from taginfo, or `key=value`), text view, copy and paste tags (Ctrl+V), undo per field or tag; pending edits survive reloads
- Static map preview of the location, parent ways and relations, links to openstreetmap.org, iD and Wikidata
- Save with your OpenStreetMap account (OAuth 2.0 with PKCE in a popup): review the changes, changeset comment and source, one changeset per save; if someone edited the object meanwhile, the tags are merged and only keys changed on both sides need a choice

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
- Copies and pastes are confirmed with a toast; pastes can be undone from the toast

### Speed

- All ~14,000 Wikidata properties are preloaded: datatypes and formatter URLs with one SPARQL query, labels, aliases and descriptions in the user language and English via the API (`prop=entityterms`, 500 per request, three in parallel); properties become available as each batch arrives
- Property search runs locally in a few milliseconds: by ID (`P31`, `31`), URL (`…/Property:P31`, `…/entity/P31`, `…/prop/direct/P31`), label or alias in English and the user language
- Item renders immediately, value labels stream in progressively
- Local cache: Cache API for properties (24 h, refreshed in the background) and entities (1 h), sessionStorage for labels. Browser refresh bypasses the cache for the current item; refreshing twice within 5 seconds drops all caches.

### Design and accessibility

- Built with [Codex](https://doc.wikimedia.org/codex/) components and design tokens (typography, colors, transitions), including dark mode
- Icon-only buttons have accessible labels and Codex tooltips (on keyboard focus, or after the pointer rests for 500 ms; created lazily to stay fast on large items)
- Everything works with the keyboard: hover actions are revealed on focus, qualifiers have edit buttons besides double-click
- Codex minimum target sizes, toasts announced to screen readers, reduced motion respected
- Open Graph and Twitter card tags for link previews

### Languages

- Searchable language selector over all Wikimedia languages, defaulting to the browser language
- UI translated into English, German, Spanish, French, Chinese, Arabic, Russian, Polish and Dutch (`src/i18n/*.json`, MediaWiki-style `$1` and `{{PLURAL:…}}` with CLDR plural forms)
- Right-to-left layout for Arabic, Hebrew, Persian, Urdu and other RTL languages

## Development

```sh
pnpm install   # also installs the Git pre-commit hook (vp config)
pnpm dev       # development server with hot reload
pnpm build     # type-check (vue-tsc) and build to dist/
pnpm preview   # serve the production build from dist/
pnpm test      # unit tests (Vitest, happy-dom); also run in CI
pnpm vp check  # format, lint and type checks
pnpm vp fmt    # format all files
pnpm vp lint   # lint only
```

OpenStreetMap logins use an OAuth 2.0 application registered on openstreetmap.org (public client, same callback URL), configured as `VITE_OSM_OAUTH_CLIENT_ID`; `VITE_OSM_URL=https://master.apis.dev.openstreetmap.org` switches viewing and saving to the OSM dev server for testing (with an application registered there).

Logging in locally uses the OAuth 2.0 consumer “DinoData (dev)” with the callback `http://localhost:5173/oauth-callback`, so the dev server is fixed to port 5173. Client IDs are in `.env.development` and `.env.production` (public clients, no secrets).

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

## Wikidata gadget

[`gadget/dinodata.js`](gadget/dinodata.js) adds a “DinoData” tab right of “Read” on Wikidata item, property and lexeme pages. To install it, copy it to `User:Simon04/DinoData.js` on wikidata.org and add to [your common.js](https://www.wikidata.org/wiki/Special:MyPage/common.js):

```js
mw.loader.load("/w/index.php?title=User:Simon04/DinoData.js&action=raw&ctype=text/javascript");
```

## License

[GPL-3.0](LICENSE) © Simon Legner. Data from Wikidata is available under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
