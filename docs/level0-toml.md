# Level0L compared with TOML

[Level0L](https://wiki.openstreetmap.org/wiki/Level0L) is the text format of the [Level0](https://level0.osmz.ru/) editor. DinoData reads and writes it in the OSM text view (`src/osm/level0.ts`, `src/osm/tags.ts`). It looks a bit like [TOML](https://toml.io/en/v1.0.0): `key = value` lines, `#` comments, and headers that start a section. But the two formats are not compatible. This page compares them and shows how OSM data could look as TOML.

The Level0 behaviour described here follows its parser, [`www/level0l.php`](https://github.com/Zverik/Level0/blob/master/www/level0l.php).

## Differences

|                   | Level0L                                                                                                                        | TOML 1.0                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Section header    | `node 1: 52.5, 13.4`, `way 123`, `relation 5.28` (with version); `-way 5` deleted, `!way 5` conflict, `way` or `way -1` new    | `[table]`, `[a.b]`, `[[array of tables]]`                                                                          |
| Value             | Raw text up to the end of the line, trimmed: `name = Main Street`                                                              | Typed: `"…"`, `'…'`, number, boolean, date, array, inline table. A bare `Main Street` is an error                  |
| Types             | Every tag value is a string, as in OSM                                                                                         | `ref = 123` would be an integer, so it must be written `ref = "123"`                                               |
| Key               | Anything before the first unescaped `=`: `name:de`, `addr:street`                                                              | Bare keys allow only `A-Z a-z 0-9 _ -`, so `"name:de"` needs quotes, and `addr.street` would become a nested table |
| `=` in a key      | `a\=b = c`                                                                                                                     | `"a=b" = "c"`                                                                                                      |
| Escapes           | Only `\=` in keys; values are taken literally                                                                                  | `\"`, `\\`, `\n`, `\uXXXX` in `"…"`; none in `'…'`                                                                 |
| Comments          | `#` in column 0, or at the end of a header line. In `a = b # c` the value is `b # c`. A key starting with `#` must be indented | `#` anywhere outside a string                                                                                      |
| Lists             | Repeated lines, in order: `nd 1`, `wy 2 forward`, `rel 3`                                                                      | `nodes = [1, 2]`, arrays of inline tables, or `[[relation.member]]`                                                |
| Duplicate key     | Warning; the first value wins                                                                                                  | Error (`Cannot overwrite a value`)                                                                                 |
| Empty value       | `key =` is invalid in Level0 (its regex needs a value); DinoData reads it as “remove the tag”                                  | `key = ""` is a valid empty string                                                                                 |
| Multi-line values | No                                                                                                                             | `"""…"""`, `'''…'''`                                                                                               |
| Object order      | One stream, types mixed in any order                                                                                           | `[[node]]`, `[[way]]`, `[[relation]]` keep their order only within each type                                       |

Level0L is the better fit for typing tags by hand: no quotes, and OSM keys like `name:de` work as written. TOML is the better fit for tools: there is a standard grammar with parsers in every language, values can be escaped, and numbers are typed.

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
- In TOML 1.0 an inline table must fit on one line. A member list over several lines therefore uses an array of inline tables, as above, or `[[relation.member]]` tables.
- Keys like `name:de` or `addr:street` need quotes: `"name:de" = "Hauptstraße"`.
- If the order of objects across types matters, a single `[[object]]` array with `type = "node"` keeps it, at the cost of a longer header.

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

## In DinoData

The text view accepts `key=value` lines, Level0L, and one-line quoted pairs like `"name:de" = "Hauptstraße"` (`QUOTED_TAG_LINE` in `src/osm/tags.ts`). So simple TOML or JSON-style tag lines can be pasted. Escapes inside the quotes (`\"`, `\\`) are not decoded, single-quoted `'…'` values are not recognised, and TOML tables, arrays and multi-line strings are not parsed.
