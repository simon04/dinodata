# DinoData for OpenStreetMap — concept

A mobile-first tag editor for OpenStreetMap nodes, ways and relations, living next to the Wikidata editor in DinoData. No geometry editing: open an object, see what it is, edit its tags comfortably, save as a changeset.

Status: milestones 1–5 implemented (see the README); the OpenStreetMap OAuth applications still need to be registered.

## Goals and non-goals

Goals:

- Open any OSM object by URL, short ID or search (Nominatim), or nearby
- Explain every tag in the user's language: what it means, whether it is deprecated, which values are common
- The nicest tag editing on a phone: big targets, suitable keyboards, value pickers instead of free typing, no hover-only UI
- Power-user escape hatch: raw `key=value` text view, paste tags
- Save with OSM OAuth 2.0 directly from the browser, with tag-level conflict resolution

Non-goals (for now):

- Geometry, creating or deleting objects, relation membership editing
- An interactive map (a small static location preview is enough to recognise the object)
- Offline editing

## Routing

DinoData uses hash routing (`#Q40`), which also works on GitHub Pages without a server fallback. OSM mode gets its own hash namespace in the same SPA:

| Hash               | View                                     |
| ------------------ | ---------------------------------------- |
| `#osm`             | OSM home: search, nearby, recent objects |
| `#osm/node/123`    | tag editor for node 123                  |
| `#osm/way/123`     | tag editor for way 123                   |
| `#osm/relation/12` | tag editor for relation 12               |
| `#Q40` etc.        | Wikidata mode (unchanged)                |

`App.vue` parses the hash into a discriminated union (`{ mode: "wikidata", id } | { mode: "osm", type?, id? }`) and switches header search, login button and home page per mode. The OSM view is loaded with `defineAsyncComponent`, so Wikidata users don't download OSM code and vice versa; the OSM view also skips `loadProperties` (the Wikidata property preload).

A separate path (`/osm/…`) or a separate Vite entry (`osm.html`) was considered: a path needs SPA fallbacks in `server.js` and breaks on GitHub Pages; a separate entry duplicates header, i18n and auth setup. A hash namespace keeps one app, one deployment, one OAuth callback page.

Cross-links between the modes:

- `wikidata=Q…`, `brand:wikidata`, `operator:wikidata`, `subject:wikidata` etc. values link to `#Q…`, with the Wikidata label shown inline (reusing `getLabels`)
- In Wikidata mode, “OSM relation ID” (P402), “OSM way/node” and “OSM tag or key” (P1282) values link to `#osm/…`

## Opening an object

One input on the OSM home page and in the header that accepts:

- OSM URLs: `https://www.openstreetmap.org/way/123`, `osm.org/node/1#map=…`, edit URLs (`/edit?way=123`), API URLs (`/api/0.6/way/123`), JOSM remote control and Overpass Turbo links where unambiguous
- Short forms: `n123`, `w123`, `r123`, `way 123`, `way/123`
- Coordinates (`47.26, 11.39`, geo: URIs) → objects at that point (see below)
- Anything else → place search

Place search:

- **Nominatim** for search on Enter (its usage policy forbids autocomplete-as-you-type, max. 1 request/s, needs a descriptive `Referer`/user agent). Results show name, preset icon/name (from `class`/`type`), and address; they carry `osm_type` + `osm_id`, so a tap opens the editor.
- Optionally **Photon** (`photon.komoot.io`, also OSM-based) for type-ahead suggestions, since it allows autocomplete. Decide after trying both.

Nearby (great on mobile, e.g. while surveying):

- “Objects near me” uses the Geolocation API and an Overpass query (`nwr(around:50,lat,lon)[~"."~"."]; out tags center;`), listing tagged objects sorted by distance with their preset name, like the “Query features” tool on openstreetmap.org
- The same list for coordinates typed into the search

Recent objects: kept in localStorage, shown on the OSM home page.

## Data sources

### OSM API 0.6 (`api.openstreetmap.org`, CORS enabled)

- `GET /api/0.6/{type}/{id}.json` — tags, version, timestamp, user, changeset
- For saving, the full element is needed (node coordinates, way node list, relation members), which the same response contains; it is kept unchanged and only `tags` replaced
- `GET /api/0.6/{type}/{id}/history.json` — optional tag history (“who set this?”), shown per tag on demand
- `GET /api/0.6/{type}/{id}/relations.json` and `/ways.json` — “part of” list (the OSM “what links here”), linking to the parents
- Location preview: node coordinates directly; ways and relations via Overpass `out center` or the Nominatim `lookup` endpoint, shown as a single static OSM tile with a marker, linked to openstreetmap.org

Local development uses the dev server (`master.apis.dev.openstreetmap.org`) via `.env.development`, so testing never touches real data.

### OSM wiki Wikibase (`wiki.openstreetmap.org`, CORS with `origin=*`)

The OSM wiki runs Wikibase with one item per key (`Key:surface`) and tag (`Tag:highway=residential`), linked to the wiki pages via sitelinks. Lookup is cheap and batched (50 per request):

```
api.php?action=wbgetentities&sites=wiki&titles=Key:surface|Tag:highway=residential
```

Useful properties (verified on the live wiki):

| Property    | Meaning                                  | Use in the editor                                         |
| ----------- | ---------------------------------------- | --------------------------------------------------------- |
| P16         | permanent key ID                         | identify key items                                        |
| P19         | permanent tag ID                         | identify tag items                                        |
| P10         | key for this tag                         | link tag → key                                            |
| P6          | status (approved, de facto, deprecated…) | status badge, warn on deprecated/discardable              |
| P17         | replaced by                              | one-tap fix for deprecated tags                           |
| P13         | value validation regex                   | validate values while typing                              |
| P9          | key type                                 | choose the input (e.g. number, yes/no, well-known values) |
| P33–P36     | applies to nodes/ways/areas/relations    | warn when a tag is used on the wrong element type         |
| P45         | implies                                  | hint that a tag is redundant                              |
| P46         | combination                              | suggest tags commonly used together                       |
| P44         | incompatible with                        | warn about contradicting tags                             |
| P22         | required key or tag                      | warn when a required companion tag is missing             |
| P28         | image (wiki file name)                   | thumbnail in the tag details                              |
| P12         | Wikidata concept                         | link to `#Q…`, Wikidata label as fallback description     |
| P31         | documentation wiki pages (per language)  | “Read more” link in the user's language                   |
| P29/P30/P48 | region restrictions                      | regional hints                                            |

Labels and descriptions are translated into many languages (e.g. 34 descriptions for `highway=residential`). Wikidata's Wikibase JSON format is the same, so `wikidata.ts` types (`Entity`, `Claim`, `Snak`) and helpers (`label`, `description`) are reused by making the API base URL a parameter. SPARQL (Sophox) is currently empty/stale and not relied on; there is no `haswbstatement` search either, so the sitelink lookup is the way in. Items are cached with `cachedFetch` (24 h, stale-while-revalidate), since they rarely change.

### iD tagging schema (presets and fields)

The [id-tagging-schema](https://github.com/openstreetmap/id-tagging-schema) (ISC license) powers iD, Rapid, Go Map!! and others. Served from jsDelivr (`@openstreetmap/id-tagging-schema@6/dist/…`): `presets.min.json` (~400 kB), `fields.min.json` (~90 kB), `translations/{lang}.min.json` (~300 kB), plus `deprecated.json` and `discarded.json`.

It provides what the wiki does not:

- **Preset matching**: “this is a Restaurant” with icon, from the tags and the element type (match score, geometry `point`/`vertex`/`line`/`area`/`relation`, derived from type and `area=*`/closed way, without loading geometry: a way's first and last node IDs suffice)
- **Fields per preset** in a sensible order with field types that map to mobile inputs: `check`/`onewayCheck`, `combo`/`typeCombo`/`semiCombo`/`multiCombo`, `number`, `tel`, `email`, `url`, `localized` (name + `name:xx`), `address`, `wikidata`, `textarea`, `access`, `radio`
- **Translated labels, placeholders and option values** for fields and presets
- **Preset search terms**, for changing the preset (“what is this?” picker)
- **Deprecated tag upgrades** (`deprecated.json`) complementing wiki P17

The schema is loaded lazily per language and cached via the Cache API, like the Wikidata properties.

### taginfo (`taginfo.openstreetmap.org/api/4`)

- `key/values` — the most common values with counts, for combo suggestions when neither the preset field nor the wiki lists options
- `keys/all` / `search/by_key_and_value` — key autocompletion in the “add tag” flow (key prefix search, ranked by use)
- Counts shown subtly (“used 4.2 M times”) to help pick the conventional spelling

### Optional later

- [Name Suggestion Index](https://nsi.guide/) for brand/operator suggestions (sets `brand`, `brand:wikidata`, `name` together)
- [opening_hours.js](https://github.com/opening-hours/opening_hours.js) for validating and pretty-printing `opening_hours` (“open now”, weekly table)

## Editor UX (mobile first)

Layout of `#osm/way/123`, top to bottom:

1. **Header card**: preset icon and name (“Restaurant”), `name` in the user's language, type and ID chip (`way 123`, tap to copy, like `EntityId`), last edit (“3 months ago by Alice”), links: openstreetmap.org, iD, JOSM remote control, Wikidata. Small static location preview.
2. **Issues**: deprecated tags with “Upgrade” button, invalid values (P13 regex, field type), tags not applying to this element type, incompatible combinations, missing required tags, common combinations as suggestions (“Add cuisine?”).
3. **Preset fields** (tags that the preset knows), each field as its own row with the best input:
   - yes/no/unknown → segmented control (three large buttons), not a checkbox
   - combo with few options → chips; with many → full-screen picker with search, translated labels, icons, taginfo counts, “Other value…”
   - `semiCombo` (`;`-separated, e.g. `cuisine=pizza;pasta`) → chip list with add/remove
   - number/phone/email/url → `inputmode`/`type` for the right keyboard, unit hints
   - `localized` (`name`, `name:de`, …) → grouped like `TermsTable`: main name plus “add language” using the existing `LanguageSelector`
   - `address` → grouped `addr:*` sub-form (street suggestions from nearby ways via Overpass, later)
   - `wikidata` → `EntitySearch` against Wikidata, shows label + description, can fill `name:xx` from Wikidata labels
   - `opening_hours` → text with live validation and a readable weekly preview
4. **Other tags**: all remaining tags as rows: key (with wiki label as caption) and value. Tapping a row opens a **bottom sheet** with the input, the wiki description, image, status, common values and “Read more on the wiki”.
5. **Add tag**: one button opening a sheet with key autocompletion (preset “moreFields” first, then taginfo), then the value input matching the key.
6. **Text view toggle**: the whole tag list as editable `key=value` lines (iD-style), for power users and for pasting; diffed back into individual edits.

Interaction details:

- No hover-only actions: every row has a visible trailing action (edit or remove); swipe gestures are avoided because they are undiscoverable and clash with system back gestures
- Tap targets ≥ 44 px, sticky bottom bar (like a mobile app action bar) with the count of pending changes, “Review” and “Save”
- Pending changes highlighted as in Wikidata mode: added green, changed yellow, removed red with strike-through; undo per tag
- Edits are kept in sessionStorage per object, so a reload or the OAuth popup loses nothing
- Keyboard flows on desktop still work: Enter in a value moves to the next field, Escape closes the sheet
- Copy/paste: copy selected tags as `key=value` lines, paste onto another object (validated, with undo toast), reusing the clipboard ideas of Wikidata mode
- Dark mode, RTL, i18n via the existing `t()` and Codex tokens

Codex components to use: `CdxField`, `CdxTextInput`, `CdxLookup`/`CdxMultiselectLookup`, `CdxChipInput`, `CdxToggleButtonGroup` (yes/no), `CdxDialog` (full-screen on narrow viewports as bottom sheet replacement), `CdxMessage` (issues), `CdxToast`. A bottom sheet is not part of Codex; a small `BottomSheet.vue` on top of `<dialog>` with Codex tokens is needed.

## Saving

### OAuth 2.0 with openstreetmap.org

openstreetmap.org supports OAuth 2.0 with PKCE for public clients and OpenID Connect discovery (`/.well-known/openid-configuration`), and its token endpoint sends `Access-Control-Allow-Origin: *` (verified). So `oidc-client-ts` from `auth.ts` works as is, with a second `UserManager`:

- Register an OAuth 2.0 application on openstreetmap.org (non-confidential, redirect `https://dinodata.toolforge.org/oauth-callback`), and one on the dev server for `http://localhost:5173/oauth-callback`
- Scopes `openid read_prefs write_api`; username from `/oauth2/userinfo` (`preferred_username`) or `/api/0.6/user/details.json`
- OSM access tokens do not expire and there is no refresh token: no silent renew needed
- `read_prefs` also gives the user's preferred languages (`/api/0.6/user/preferences`), which can default the OSM tag language
- Refactor `auth.ts` into `useAuth("wikimedia" | "osm")` with a provider config; the callback page completes whichever flow is pending (`oidc-client-ts` stores state per authority). `UserMenu` shows the login of the current mode.

### Upload

1. Review sheet: list of tag changes (old → new), changeset comment (required, prefilled suggestion like “Add opening hours to Café X”), optional `source` (survey, local knowledge, imagery) and hashtags
2. `PUT /api/0.6/changeset/create` with `comment`, `created_by=DinoData <version>`, `source`, `locale`
3. `POST /api/0.6/changeset/{id}/upload` with an osmChange `<modify>` of the full element (unchanged geometry/members, new tags, the `version` it was loaded with)
4. `PUT /api/0.6/changeset/{id}/close`
5. Reload the object, toast with link to the changeset

All uploads are XML (OSM API 0.6); a small serializer for one element is enough.

### Conflicts

`409 Conflict` on version mismatch. Since only tags are edited, a **three-way merge on tags** resolves most conflicts automatically: base (loaded version), mine (pending edits), theirs (current version). Keys changed only on one side merge silently; keys changed on both sides to different values are shown for the user to choose; then upload again with the new version. Geometry changes by others don't matter, since the current geometry is reused.

### Later: multi-object changesets

A “basket” of edited objects (e.g. while walking down a street) uploaded as one changeset with one osmChange containing several `<modify>` elements.

## Code structure

```
src/osm/
  osm.ts            OSM API: get element, parents, history, changeset create/upload/close, XML
  osm-ref.ts        parse URLs, short IDs, coordinates → { type, id } | { lat, lon } | query
  nominatim.ts      search, lookup, reverse
  overpass.ts       nearby objects, center of ways/relations
  osmwiki.ts        key/tag items via sitelinks, status, regex, applies-to… (reuses wikidata.ts with another API base)
  presets.ts        load id-tagging-schema + translations, match preset, fields for preset
  taginfo.ts        values, key search
  tags.ts           tag edits, diff, text view parse/serialize, three-way merge
  validate.ts       issues from wiki + presets + regex
src/components/osm/
  OsmHome.vue, OsmSearch.vue, OsmElementView.vue, OsmHeaderCard.vue,
  TagField.vue (per field type), TagRow.vue, TagSheet.vue, AddTagSheet.vue,
  TagTextView.vue, OsmIssues.vue, OsmSaveDialog.vue, BottomSheet.vue
```

Shared with Wikidata mode: `cache.ts`, `i18n`, `auth.ts` (generalised), `format.ts` (dates, numbers), `clipboard.ts` ideas, `LanguageSelector`, `EntitySearch`, `EntityId`-style chips, `MediaDialog` (for `wikimedia_commons`/`image` tags), `tooltip.ts`.

Each `.ts` module gets a `.spec.ts` like the existing ones (URL parsing, preset matching, tag diff and merge, osmChange XML are pure functions and easy to test).

## Milestones

1. **Read-only viewer**: routing, URL/ID parsing, OSM API fetch, preset matching, wiki descriptions, tag list with explanations, Wikidata cross-links
2. **Search**: Nominatim search, nearby via Overpass, recent objects
3. **Editing**: tag rows + bottom sheet, preset fields with typed inputs, add tag with taginfo, text view, pending edits with undo
4. **Saving**: OSM OAuth, review + changeset comment, upload, three-way merge on conflict
5. **Quality**: issues/validation (deprecated, regex, applies-to, combinations), opening_hours, address, NSI brands
6. **Later**: multi-object changesets, tag history per key

## Open questions

- Photon for type-ahead, or Nominatim only (on Enter)?
- Load the full id-tagging-schema (~800 kB with translations, cached) or ship a trimmed build of the fields/presets actually needed?
- Should the OSM mode get its own branding/home page text, or stay “DinoData” with an OSM tab?
- Usage policies: Nominatim and Overpass ask for low request rates and an identifying `Referer`; the public instances are fine for an interactive tool, but heavy “nearby” use may warrant caching or a different Overpass instance.
