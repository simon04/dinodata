# OSM formats compared with TOML

OpenStreetMap data comes in several text formats. OSM XML is exact but verbose, OSM JSON has no comments, and Level0L is easy to type but has no grammar beyond its parser. TOML has comments, a spec and parsers in most languages, including Python's standard library. So what would OSM data look like as TOML? I came across this question while adding an OSM tag editor to [DinoData](https://github.com/simon04/dinodata). Below, each format is compared with TOML using the examples from the OSM wiki, and the TOML versions are checked with Python's `tomllib`.

[Level0L](https://wiki.openstreetmap.org/wiki/Level0L) is the text format of the [Level0](https://level0.osmz.ru/) editor. DinoData reads and writes it in the OSM text view (`src/osm/level0.ts`, `src/osm/tags.ts`). It looks a bit like [TOML](https://toml.io/en/v1.0.0): `key = value` lines, `#` comments, and headers that start a section. But the two formats are not compatible. This page compares them, together with the other formats DinoData meets, and shows how OSM data could look as TOML.

| Format                                                                   | Syntax                                      | Used for             | In the OSM API                                                                                                | In DinoData                              |
| ------------------------------------------------------------------------ | ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [Level0L](https://wiki.openstreetmap.org/wiki/Level0L)                   | Lines of text                               | Editing in Level0    | –                                                                                                             | Text view: read and write                |
| [JOSM file format](https://wiki.openstreetmap.org/wiki/JOSM_file_format) | OSM XML with `action`, `<bounds>`, `upload` | Saving edits in JOSM | Plain OSM XML is the default response, and the body of `PUT` for single elements                              | –                                        |
| [OSM JSON](https://wiki.openstreetmap.org/wiki/OSM_JSON)                 | JSON                                        | Reading              | Elements, history, `full`, `map` and more, with a `.json` suffix or `Accept: application/json`                | Reading elements, history and changesets |
| [osmChange](https://wiki.openstreetmap.org/wiki/OsmChange)               | XML with `<create>`, `<modify>`, `<delete>` | Changes              | `GET /api/0.6/changeset/#id/download`, and the only format of the upload `POST /api/0.6/changeset/#id/upload` | Saving tags                              |

The Level0 behaviour described here follows its parser, [`www/level0l.php`](https://github.com/Zverik/Level0/blob/master/www/level0l.php).

## Differences

|                   | Level0L                                                                                                                        | JOSM and osmChange (OSM XML)                                                                                                                                                                                                                  | OSM JSON                                                                                                                           | TOML 1.0                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Section header    | `node 1: 52.5, 13.4`, `way 123`, `relation 5.28` (with version); `-way 5` deleted, `!way 5` conflict, `way` or `way -1` new    | An element: `<node id='1' lat='52.5' lon='13.4'>`, `<way id='123' version='28'>`; `action='delete'` or `action='modify'`, a negative `id` for new objects; in osmChange, elements are grouped in `<create>`, `<modify>` and `<delete>` blocks | An object in `elements`: `{"type": "node", "id": 1, "lat": 52.5, "lon": 13.4}`; `"visible": false` for deleted objects in history  | `[table]`, `[a.b]`, `[[array of tables]]`                                                                          |
| Value             | Raw text up to the end of the line, trimmed: `name = Main Street`                                                              | An XML attribute: `<tag k='name' v='Main Street' />`                                                                                                                                                                                          | A JSON string: `"name": "Main Street"` in `tags`                                                                                   | Typed: `"…"`, `'…'`, number, boolean, date, array, inline table. A bare `Main Street` is an error                  |
| Types             | Every tag value is a string, as in OSM                                                                                         | Every attribute is a string                                                                                                                                                                                                                   | `id`, `lat`, `lon`, `version`, `changeset`, `uid` are numbers; tag values and `timestamp` are strings                              | `ref = 123` would be an integer, so it must be written `ref = "123"`                                               |
| Key               | Anything before the first unescaped `=`: `name:de`, `addr:street`                                                              | Any string in `k='…'`                                                                                                                                                                                                                         | Any JSON string: `"name:de"`                                                                                                       | Bare keys allow only `A-Z a-z 0-9 _ -`, so `"name:de"` needs quotes, and `addr.street` would become a nested table |
| `=` in a key      | `a\=b = c`                                                                                                                     | No escape needed: `k='a=b'`                                                                                                                                                                                                                   | No escape needed: `"a=b"`                                                                                                          | `"a=b" = "c"`                                                                                                      |
| Escapes           | Only `\=` in keys; values are taken literally                                                                                  | XML entities: `&amp;`, `&lt;`, `&apos;`, `&quot;`, `&#10;`                                                                                                                                                                                    | `\"`, `\\`, `\n`, `\uXXXX`                                                                                                         | `\"`, `\\`, `\n`, `\uXXXX` in `"…"`; none in `'…'`                                                                 |
| Comments          | `#` in column 0, or at the end of a header line. In `a = b # c` the value is `b # c`. A key starting with `#` must be indented | `<!-- … -->`                                                                                                                                                                                                                                  | None                                                                                                                               | `#` anywhere outside a string                                                                                      |
| Lists             | Repeated lines, in order: `nd 1`, `wy 2 forward`, `rel 3`                                                                      | Child elements, in order: `<nd ref='1' />`, `<member type='way' ref='2' role='forward' />`                                                                                                                                                    | `"nodes": [1, 2]`, `"members": [{"type": "way", "ref": 2, "role": "forward"}]`                                                     | `nodes = [1, 2]`, arrays of inline tables, or `[[relation.member]]`                                                |
| Duplicate key     | Warning; the first value wins                                                                                                  | Not prevented by the XML syntax                                                                                                                                                                                                               | Names “SHOULD be unique” ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259#section-4)); Python and JavaScript keep the last value | Error (`Cannot overwrite a value`)                                                                                 |
| Empty value       | `key =` is invalid in Level0 (its regex needs a value); DinoData reads it as “remove the tag”                                  | `v=''` is valid XML                                                                                                                                                                                                                           | `""`                                                                                                                               | `key = ""` is a valid empty string                                                                                 |
| Multi-line values | No                                                                                                                             | Only as `&#10;`; a raw newline in an attribute is read as a space                                                                                                                                                                             | Only as `\n`                                                                                                                       | `"""…"""`, `'''…'''`                                                                                               |
| Object order      | One stream, types mixed in any order                                                                                           | Grouped by type: nodes, then ways, then relations; osmChange: blocks in document order                                                                                                                                                        | One `elements` array, types mixed                                                                                                  | `[[node]]`, `[[way]]`, `[[relation]]` keep their order only within each type                                       |

Level0L is the better fit for typing tags by hand: no quotes, and OSM keys like `name:de` work as written. TOML is the better fit for tools: there is a standard grammar with parsers in every language, values can be escaped, and numbers are typed. OSM XML and OSM JSON are what the API and the tools exchange; they are exact but verbose to read and write by hand. OSM JSON and TOML have the same data model (objects, arrays, strings, numbers), so the conversion between the two is lossless.

## Example

From the [Level0L wiki page](https://wiki.openstreetmap.org/wiki/Level0L#Examples) (CC BY-SA 2.0, OpenStreetMap wiki contributors), a Level0 version of the [OSM XML example](https://wiki.openstreetmap.org/wiki/OSM_XML#Example_OSM_XML_file). `...` stands for lines left out.

### Level0L

```
node 298884269.1: 54.0901746, 12.2482632 # made by user SvenHRO (46882) in changeset 676636 on 2008-09-21T21:37:45Z
node 261728686: 54.0906309, 12.2441924 # versions should be stored server-side
node 1831881213: 54.0900666, 12.2539381 # comments are not allowed in tag values, '=' is screened (\=) only in keys
  name = Neu Broderstorf
  traffic_sign = city_limit
...
node 298884272: 54.0901447, 12.2516513

way 26659127.5
  nd 292403538
  nd 298884289
  ...
  nd 261728686
  highway = unclassified
  name = Pastower Straße

relation 56688.28 # member types: nd, wy, rel; roles are put after ids
  nd 294942404
  ...
  nd 364933006
  wy 4579143 forward
  ...
  nd 249673494
  name = Küstenbus Linie 123
  network = VVW
  operator = Regionalverkehr Küste
  ref = 123
  route = bus
  type = route

...
```

### As TOML

One possible mapping: an array of tables per object type, the `ID.version` header split into `id` and `version`, and tags in a `tags` sub-table. The header comments are kept; the two that describe Level0L syntax are rewritten for TOML.

```toml
[[node]]
id = 298884269
version = 1
lat = 54.0901746
lon = 12.2482632
# made by user SvenHRO (46882) in changeset 676636 on 2008-09-21T21:37:45Z

[[node]]
id = 261728686
lat = 54.0906309
lon = 12.2441924
# versions should be stored server-side

[[node]]
id = 1831881213
lat = 54.0900666
lon = 12.2539381
# comments may follow any value; keys with '=' or ':' are quoted
[node.tags]
name = "Neu Broderstorf"
traffic_sign = "city_limit"

# …

[[node]]
id = 298884272
lat = 54.0901447
lon = 12.2516513

[[way]]
id = 26659127
version = 5
nodes = [
  292403538,
  298884289,
  # …
  261728686,
]
[way.tags]
highway = "unclassified"
name = "Pastower Straße"

# member types: node, way, relation; role is optional
[[relation]]
id = 56688
version = 28
members = [
  { type = "node", ref = 294942404 },
  # …
  { type = "node", ref = 364933006 },
  { type = "way", ref = 4579143, role = "forward" },
  # …
  { type = "node", ref = 249673494 },
]
[relation.tags]
name = "Küstenbus Linie 123"
network = "VVW"
operator = "Regionalverkehr Küste"
ref = "123"
route = "bus"
type = "route"
```

Notes on the mapping:

- `[node.tags]` belongs to the most recent `[[node]]`, so `id`, `lat`, `lon`, `nodes` and `members` must come before it. In Level0L, tags and references can be in any order.
- In the TOML version, `ref = "123"` has to be quoted. `ref = 123` would be an integer, while OSM tag values are always strings.
- In TOML 1.0 an inline table must fit on one line. A member list over several lines therefore uses an array of inline tables, as above, or `[[relation.member]]` tables. [TOML 1.1](https://toml.io/en/v1.1.0) also allows newlines and a trailing comma inside an inline table.
- Keys like `name:de` or `addr:street` need quotes: `"name:de" = "Hauptstraße"`.
- If the order of objects across types matters, a single array with `type = "node"` on each object keeps it, at the cost of a longer header. This is how OSM JSON does it, see [OSM JSON](#osm-json).

### New and deleted objects

The second example on the wiki page, taken from the [JOSM file format](https://wiki.openstreetmap.org/wiki/JOSM_file_format), has a new node without ID and a deleted node:

```
node 26821100: 51.5077286, -0.1279688
  created_by = Potlatch 0.10f
  name = Nelson's Column
  tourism = attraction
  monument = statue
  historic = monument
node: 51.507661490456606, -0.1278000843634869
-node 346364767
```

```toml
[[node]]
id = 26821100
lat = 51.5077286
lon = -0.1279688
[node.tags]
created_by = "Potlatch 0.10f"
name = "Nelson's Column"
tourism = "attraction"
monument = "statue"
historic = "monument"

# new: no id (or a negative one)
[[node]]
lat = 51.507661490456606
lon = -0.1278000843634869

[[node]]
id = 346364767
deleted = true
```

A Level0L conflict (`!node 1`) would become `conflict = true`. The `changeset` object, which has only tags, would become a single `[changeset]` table.

## JOSM file format

The [JOSM file format](https://wiki.openstreetmap.org/wiki/JOSM_file_format) is OSM XML as the API returns it, with additions for local edits: `<bounds>` with an `origin` for each download, `action='modify'` or `action='delete'` on changed objects, negative IDs for new objects (also usable as references elsewhere in the file), and `upload='false'` or `upload='never'` on `<osm>`. Objects are grouped by type, which is how the `[[node]]`, `[[way]]` and `[[relation]]` arrays above work too.

### JOSM XML

The example from the wiki page is the same data as the second Level0L example, with the metadata that Level0L leaves out:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<osm version='0.6' generator='JOSM'>
  <bounds minlat='51.5076478723889' minlon='-0.127989783553507' maxlat='51.5077445145483' maxlon='-0.127774884645096' origin='OpenStreetMap server' />
  <node id='26821100' timestamp='2009-02-16T21:34:57+00:00' user='dankarran' visible='true' lat='51.5077286' lon='-0.1279688'>
    <tag k='created_by' v='Potlatch 0.10f' />
    <tag k='name' v='Nelson&apos;s Column' />
    <tag k='tourism' v='attraction' />
    <tag k='monument' v='statue' />
    <tag k='historic' v='monument' />
  </node>
  <node id='-1' visible='true' lat='51.507661490456606' lon='-0.1278000843634869' />
  <node id='346364767' action='delete' timestamp='2009-02-16T21:34:44+00:00' user='dankarran' visible='true' lat='51.5076698' lon='-0.1278143' />
</osm>
```

### As TOML

Attributes of `<osm>` become top-level keys, which TOML requires before the first table. Each `<bounds>` becomes a `[[bounds]]` table. Element attributes become keys, and `<tag>` elements go into `tags` as before:

```toml
version = "0.6"
generator = "JOSM"

[[bounds]]
minlat = 51.5076478723889
minlon = -0.127989783553507
maxlat = 51.5077445145483
maxlon = -0.127774884645096
origin = "OpenStreetMap server"

[[node]]
id = 26821100
timestamp = 2009-02-16T21:34:57+00:00
user = "dankarran"
visible = true
lat = 51.5077286
lon = -0.1279688
[node.tags]
created_by = "Potlatch 0.10f"
name = "Nelson's Column"
tourism = "attraction"
monument = "statue"
historic = "monument"

[[node]]
id = -1
visible = true
lat = 51.507661490456606
lon = -0.1278000843634869

[[node]]
id = 346364767
action = "delete"
timestamp = 2009-02-16T21:34:44+00:00
user = "dankarran"
visible = true
lat = 51.5076698
lon = -0.1278143
```

Notes on the mapping:

- `timestamp` is a TOML offset date-time, not a string; `tomllib` returns a timezone-aware `datetime.datetime`. `visible` is a boolean, and `id`, `lat` and `lon` are numbers. In XML all of them are strings.
- `version = "0.6"` stays a string: it names the API version and is not a number to calculate with.
- `upload='false'` or `upload='never'` would be `upload = "false"` or `upload = "never"`. A TOML boolean `false` next to the string `"never"` would give one key two types.
- `Nelson&apos;s Column` needs no escape in a TOML basic string: `"Nelson's Column"`.
- Ways and relations map as in the Level0L example: `<nd ref='…' />` to `nodes = [...]`, `<member type='…' ref='…' role='…' />` to `members = [{ type = "…", ref = …, role = "…" }]`.
- A TOML mapping for both formats could use JOSM's `action = "delete"` instead of `deleted = true`, and a negative `id` for new objects, which Level0L also accepts (`node -1: …`). Then a Level0L file converts to the same TOML as the JOSM file, minus the metadata.

## OSM JSON

The API returns [OSM JSON](https://wiki.openstreetmap.org/wiki/OSM_JSON) for reads (elements, history, `full`, `map`, multi fetch, relations and ways of an element) when the path ends in `.json` or the `Accept` header is `application/json`. It is based on the [Overpass API JSON format](https://dev.overpass-api.de/output_formats.html#json): one `elements` array, `type` on each element, `tags` as an object, `nodes` as an array of IDs and `members` as an array of `type`/`ref`/`role` objects. `"visible": false` appears only for deleted versions in history calls.

### JSON

The example from the OSM JSON wiki page, `GET /api/0.6/relation/10000000/full.json`, with its two untagged nodes left out:

```json
{
  "version": "0.6",
  "generator": "CGImap 0.8.1 (6263 thorn-01.openstreetmap.org)",
  "copyright": "OpenStreetMap and contributors",
  "attribution": "http://www.openstreetmap.org/copyright",
  "license": "http://opendatacommons.org/licenses/odbl/1-0/",
  "elements": [
    {
      "type": "node",
      "id": 6772305769,
      "lat": 50.2106895,
      "lon": 8.5857061,
      "timestamp": "2019-09-04T15:05:00Z",
      "version": 1,
      "changeset": 74092935,
      "user": "Jonaes",
      "uid": 4433367,
      "tags": {
        "bicycle": "yes",
        "information": "guidepost",
        "ref": "OU.425.1",
        "tourism": "information"
      }
    },
    {
      "type": "way",
      "id": 5123563,
      "timestamp": "2019-09-04T15:05:00Z",
      "version": 7,
      "changeset": 74092935,
      "user": "Jonaes",
      "uid": 4433367,
      "nodes": [35352060, 35352061, 35352062, 35352063, 2056819178, 35352001],
      "tags": {
        "bicycle": "yes",
        "foot": "yes",
        "highway": "track",
        "horse": "yes",
        "lcn": "yes",
        "motor_vehicle": "agricultural;forestry",
        "surface": "asphalt",
        "tracktype": "grade1",
        "traffic_sign": "DE:260,DE:1026-36"
      }
    },
    {
      "type": "relation",
      "id": 10000000,
      "timestamp": "2019-09-18T18:21:44Z",
      "version": 2,
      "changeset": 74641141,
      "user": "HoloDuke",
      "uid": 75317,
      "members": [
        {
          "type": "node",
          "ref": 6772305769,
          "role": "sign"
        },
        {
          "type": "node",
          "ref": 35352001,
          "role": "intersection"
        },
        {
          "type": "way",
          "ref": 5123563,
          "role": "to"
        }
      ],
      "tags": {
        "bicycle": "yes",
        "colour:arrow": "green",
        "colour:back": "white",
        "colour:text": "green",
        "destination": "Friedrichsdorf;Bad Homburg",
        "destination:symbol": ";train_station",
        "distance": "8.0;4.6",
        "type": "destination_sign"
      }
    }
  ]
}
```

### As TOML

The same structure, one to one. Each JSON object becomes a table, and `elements` an array of tables:

```toml
version = "0.6"
generator = "CGImap 0.8.1 (6263 thorn-01.openstreetmap.org)"
copyright = "OpenStreetMap and contributors"
attribution = "http://www.openstreetmap.org/copyright"
license = "http://opendatacommons.org/licenses/odbl/1-0/"

[[elements]]
type = "node"
id = 6772305769
lat = 50.2106895
lon = 8.5857061
timestamp = "2019-09-04T15:05:00Z"
version = 1
changeset = 74092935
user = "Jonaes"
uid = 4433367
[elements.tags]
bicycle = "yes"
information = "guidepost"
ref = "OU.425.1"
tourism = "information"

[[elements]]
type = "way"
id = 5123563
timestamp = "2019-09-04T15:05:00Z"
version = 7
changeset = 74092935
user = "Jonaes"
uid = 4433367
nodes = [35352060, 35352061, 35352062, 35352063, 2056819178, 35352001]
[elements.tags]
bicycle = "yes"
foot = "yes"
highway = "track"
horse = "yes"
lcn = "yes"
motor_vehicle = "agricultural;forestry"
surface = "asphalt"
tracktype = "grade1"
traffic_sign = "DE:260,DE:1026-36"

[[elements]]
type = "relation"
id = 10000000
timestamp = "2019-09-18T18:21:44Z"
version = 2
changeset = 74641141
user = "HoloDuke"
uid = 75317
members = [
  { type = "node", ref = 6772305769, role = "sign" },
  { type = "node", ref = 35352001, role = "intersection" },
  { type = "way", ref = 5123563, role = "to" },
]
[elements.tags]
bicycle = "yes"
"colour:arrow" = "green"
"colour:back" = "white"
"colour:text" = "green"
destination = "Friedrichsdorf;Bad Homburg"
"destination:symbol" = ";train_station"
distance = "8.0;4.6"
type = "destination_sign"
```

Notes on the mapping:

- `tomllib` returns exactly what `json.loads` returns for the JSON above (see [Parsing with Python](#parsing-with-python)), so a converter can go both ways without losing anything. The only JSON value without a TOML equivalent is `null`, which OSM JSON does not use.
- The top-level `version = "0.6"` is the API version, a string; `version = 1` in an element is the element version, a number.
- `timestamp` stays a string here, as in the JSON. As a TOML date-time (`timestamp = 2019-09-04T15:05:00Z`) it would be a `datetime` in Python, but no longer equal to the JSON.
- This is the single-array layout mentioned in the Level0L notes. Compared with `[[node]]`, `[[way]]` and `[[relation]]`, it keeps the order of the objects, and every object needs a `type` line.

### Alternatives for members

The array of inline tables above is the only form that loads to the same data as OSM JSON, so it is the default. These forms also parse with `tomllib`.

**Array of tables.** The same data as the inline tables, so it is still equal to OSM JSON. It takes four lines per member, but stays readable when a member has more keys than fits on one line. Like `[elements.tags]`, the member tables come after the relation's own keys (`id`, `version`, …):

```toml
[[elements.members]]
type = "node"
ref = 6772305769
role = "sign"

[[elements.members]]
type = "node"
ref = 35352001
role = "intersection"

[[elements.members]]
type = "way"
ref = 5123563
role = "to"
```

**Array of arrays.** Compact and still typed: TOML 1.0 allows mixed types in one array. The meaning comes from the position, so it is no longer equal to OSM JSON: `[['node', 6772305769, 'sign'], …]` in Python, converted with `dict(zip(("type", "ref", "role"), m))`.

```toml
members = [
  ["node", 6772305769, "sign"],
  ["node", 35352001, "intersection"],
  ["way", 5123563, "to"],
]
```

**Strings.** The shortest, close to Level0L, with the `n`/`w`/`r` prefixes of osmium and Overpass IDs. Every reader has to split and parse the strings, and TOML no longer checks that `ref` is a number:

```toml
members = ["n6772305769 sign", "n35352001 intersection", "w5123563 to"]
```

A table keyed by member, like `members = { n6772305769 = "sign" }`, does not work. A relation can contain the same object twice, which TOML rejects as a duplicate key, and the TOML spec does not keep the order of keys, which matters for members.

## osmChange

[osmChange](https://wiki.openstreetmap.org/wiki/OsmChange) (`.osc`) describes changes: `<create>`, `<modify>` and `<delete>` blocks, each holding elements in OSM XML. The API returns it for `GET /api/0.6/changeset/#id/download`, and the [diff upload](https://wiki.openstreetmap.org/wiki/API_v0.6#Diff_upload:_POST_/api/0.6/changeset/#id/upload), `POST /api/0.6/changeset/#id/upload`, takes it as the request body. Each element is replaced as a whole: there are no tag-level changes, so a modified element lists all its tags, nodes and members.

### osmChange XML

The two examples from the osmChange wiki page. A modified node:

```xml
<osmChange version="0.6" generator="acme osm editor">
    <modify>
        <node id="1234" changeset="42" version="2" lat="12.1234567" lon="-8.7654321">
            <tag k="amenity" v="school"/>
        </node>
    </modify>
</osmChange>
```

New objects with placeholder IDs: two nodes and a way between them.

```xml
<osmChange>
    <create>
        <node id="-1" changeset="43" version="1" lat="-33.9133123" lon="151.1173123" />
        <node id="-2" changeset="43" version="1" lat="-33.9233321" lon="151.1173321" />
        <way id="-1" changeset="43" version="1">
            <nd ref="-1"/>
            <nd ref="-2"/>
        </way>
    </create>
</osmChange>
```

### As TOML

One flat `[[osmChange]]` array, with the block name as `action` on each element:

```toml
version = "0.6"
generator = "acme osm editor"

[[osmChange]]
type = "node"
action = "modify"
id = 1234
changeset = 42
version = 2
lat = 12.1234567
lon = -8.7654321
[osmChange.tags]
amenity = "school"
```

```toml
[[osmChange]]
type = "node"
action = "create"
id = -1
changeset = 43
version = 1
lat = -33.9133123
lon = 151.1173123

[[osmChange]]
type = "node"
action = "create"
id = -2
changeset = 43
version = 1
lat = -33.9233321
lon = 151.1173321

[[osmChange]]
type = "way"
action = "create"
id = -1
changeset = 43
version = 1
nodes = [-1, -2]
```

Notes on the mapping:

- In XML, blocks are applied in document order, and an element can appear in several of them, for example created as `-1` and then deleted. One flat array with `action` keeps this order across blocks and types. Nested tables like `[[create.node]]` would not.
- `<delete if-unused="…">` would become `if-unused = true` on each element; `-` is allowed in bare TOML keys.
- The `osmChange` root attributes `version` and `generator` are optional and ignored by the API.

### The upload: `POST /api/0.6/changeset/#id/upload`

The API v0.6 page lists what the upload requires beyond the osmChange format:

- Every element has a `changeset` attribute with the ID from the URL, and a `version`, except in `<create>`, where the server sets the version.
- Elements need no `user` and `uid`.
- Negative IDs in `<create>` are placeholders. They are replaced in later references (`<nd ref="-1"/>`, members) for the rest of the file.
- The upload runs in one transaction: either all changes apply or none. A wrong `version` fails with 409 Conflict.
- The response is a `<diffResult>` with one `<node|way|relation old_id="…" new_id="…" new_version="…"/>` per uploaded element. For deletions, `new_id` and `new_version` are left out.

The upload takes only osmChange XML. The API page documents no other format, and CGImap has only an XML parser for it (`osmchange_xml_input_format.hpp`). A JSON osmChange is proposed in [CGImap pull request #407](https://github.com/zerebubuth/openstreetmap-cgimap/pull/407), open since May 2024. Its format is the flat layout above: a root with `version` and `generator`, and an `osmChange` array of elements with `type`, `action`, optional `if-unused`, `id`, `lat`, `lon`, `version`, `changeset`, `tags`, `nodes` and `members`. The TOML above, loaded and written out as JSON, is a valid message in that format.

## Parsing with Python

Since Python 3.11 the standard library reads TOML with [`tomllib`](https://docs.python.org/3.15/library/tomllib.html); Python 3.15 added TOML 1.1 support. All TOML examples above parse without errors and become built-in types (`dict`, `list`, `str`, `int`, `float`, `bool`, and `datetime.datetime` for the JOSM timestamps):

```python
import tomllib
from pathlib import Path

data = tomllib.loads(Path("example.toml").read_text())
```

The first example (abridged):

```python
{'node': [{'id': 298884269, 'version': 1, 'lat': 54.0901746, 'lon': 12.2482632},
          …,
          {'id': 1831881213, 'lat': 54.0900666, 'lon': 12.2539381,
           'tags': {'name': 'Neu Broderstorf', 'traffic_sign': 'city_limit'}},
          …],
 'way': [{'id': 26659127, 'version': 5,
          'nodes': [292403538, 298884289, 261728686],
          'tags': {'highway': 'unclassified', 'name': 'Pastower Straße'}}],
 'relation': [{'id': 56688, 'version': 28,
               'members': [{'type': 'node', 'ref': 294942404},
                           {'type': 'node', 'ref': 364933006},
                           {'type': 'way', 'ref': 4579143, 'role': 'forward'},
                           {'type': 'node', 'ref': 249673494}],
               'tags': {'name': 'Küstenbus Linie 123', 'network': 'VVW',
                        'operator': 'Regionalverkehr Küste', 'ref': '123',
                        'route': 'bus', 'type': 'route'}}]}
```

The second example:

```python
{'node': [{'id': 26821100, 'lat': 51.5077286, 'lon': -0.1279688,
           'tags': {'created_by': 'Potlatch 0.10f', 'name': "Nelson's Column",
                    'tourism': 'attraction', 'monument': 'statue',
                    'historic': 'monument'}},
          {'lat': 51.507661490456606, 'lon': -0.1278000843634869},
          {'id': 346364767, 'deleted': True}]}
```

Working with it is plain `dict` and `list` code. Optional fields are absent rather than empty, so use `.get()`:

```python
rel = data["relation"][0]
rel["tags"]["ref"]                                          # '123'
[m["ref"] for m in rel["members"] if m["type"] == "way"]    # [4579143]
[m.get("role", "") for m in rel["members"]]                 # ['', '', 'forward', '']

for node in data["node"]:
    node.get("id")          # None for a new node
    node.get("tags", {})    # {} for an untagged node
```

Back to Level0L takes a few lines. For the second example this gives exactly the wiki text, with tags sorted by key:

```python
KINDS = {"node": "nd", "way": "wy", "relation": "rel"}

def to_level0(type_, o):
    head = ("-" if o.get("deleted") else "") + type_
    if "id" in o:
        head += f" {o['id']}"
    if type_ == "node" and "lat" in o:
        head += f": {o['lat']}, {o['lon']}"
    tags = [f"  {k.replace('=', chr(92) + '=')} = {v}" for k, v in sorted(o.get("tags", {}).items())]
    nodes = [f"  nd {ref}" for ref in o.get("nodes", [])]
    members = [f"  {KINDS[m['type']]} {m['ref']} {m.get('role', '')}".rstrip() for m in o.get("members", [])]
    return "\n".join([head, *tags, *nodes, *members])

print("\n".join(to_level0(t, o) for t, objects in data.items() for o in objects))
```

```
node 26821100: 51.5077286, -0.1279688
  created_by = Potlatch 0.10f
  historic = monument
  monument = statue
  name = Nelson's Column
  tourism = attraction
node: 51.507661490456606, -0.1278000843634869
-node 346364767
```

OSM JSON and its TOML version load to the same Python object:

```python
import json, tomllib

api = json.loads(Path("relation.json").read_text())      # the OSM JSON example
toml = tomllib.loads(Path("relation.toml").read_text())  # its TOML version
api == toml                                              # True
```

The first osmChange example, loaded from TOML and written as JSON, has the structure proposed for a JSON upload:

```python
print(json.dumps(tomllib.loads(Path("modify.toml").read_text()), indent=2))
```

```json
{
  "version": "0.6",
  "generator": "acme osm editor",
  "osmChange": [
    {
      "type": "node",
      "action": "modify",
      "id": 1234,
      "changeset": 42,
      "version": 2,
      "lat": 12.1234567,
      "lon": -8.7654321,
      "tags": {
        "amenity": "school"
      }
    }
  ]
}
```

Things to know:

| Input                                             | `tomllib` result                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ref = 123`                                       | `{'ref': 123}`, an `int`: tag values must be quoted, or converted with `str()` |
| `name = Main Street`                              | `TOMLDecodeError: Invalid value`                                               |
| `name:de = "x"`                                   | `TOMLDecodeError: Expected '=' after a key in a key/value pair`                |
| `a = "1"` and `a = "2"`                           | `TOMLDecodeError: Cannot overwrite a value` (Level0 only warns)                |
| `m = { type = "way", ref = 1,`<br>`role = "x", }` | Parsed with Python 3.15 (TOML 1.1); an error for TOML 1.0 parsers              |

- Comments, including the `# …` placeholders, are dropped. So is the order of objects across `node`, `way` and `relation`.
- Coordinates become `float`; 7-decimal OSM values print back unchanged.
- `tomllib` only reads. Writing needs a package such as [`tomli-w`](https://pypi.org/project/tomli-w/), or [`tomlkit`](https://pypi.org/project/tomlkit/) to keep comments and formatting.

## In DinoData

DinoData reads elements, history and changesets as OSM JSON (`src/osm/osm.ts`). It saves tags with a diff upload of one `<modify>` element (`osmChangeXml`, `saveTags`), keeping the coordinates, nodes, members and version, and reads the new version from the `<diffResult>`.

The text view accepts `key=value` lines, Level0L, and one-line quoted pairs like `"name:de" = "Hauptstraße"` (`QUOTED_TAG_LINE` in `src/osm/tags.ts`). So simple TOML or JSON-style tag lines can be pasted. Escapes inside the quotes (`\"`, `\\`) are not decoded, single-quoted `'…'` values are not recognised, and TOML tables, arrays and multi-line strings are not parsed.
