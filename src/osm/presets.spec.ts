import { describe, expect, it } from "vite-plus/test";
import {
  deprecations,
  fieldMatchesKey,
  geometries,
  humanize,
  iconUrl,
  matchPreset,
  presetFields,
  schemaLanguage,
  searchPresets,
  type Schema,
} from "./presets";

const schema: Schema = {
  presets: {
    point: { tags: {}, geometry: ["point", "vertex"], fields: ["name"] },
    area: { tags: { area: "yes" }, geometry: ["area"], fields: ["name"] },
    line: { tags: {}, geometry: ["line"], fields: ["name"] },
    amenity: {
      tags: { amenity: "*" },
      geometry: ["point", "area"],
      fields: ["name", "amenity"],
    },
    "amenity/restaurant": {
      tags: { amenity: "restaurant" },
      geometry: ["point", "area"],
      fields: ["name", "cuisine", "{@templates/contact}"],
      moreFields: ["outdoor_seating"],
      icon: "maki-restaurant",
    },
    // no fields: inherited from "amenity", without the amenity field
    "amenity/cafe": { tags: { amenity: "cafe" }, geometry: ["point"] },
    "@templates/contact": {
      tags: {},
      geometry: ["point"],
      fields: ["phone"],
    },
    building: {
      tags: { building: "*" },
      geometry: ["area"],
      fields: ["building"],
      matchScore: 0.6,
    },
    address: {
      tags: { "addr:*": "*" },
      geometry: ["point", "area"],
      fields: ["address"],
      matchScore: 0.15,
    },
  },
  fields: {
    name: { key: "name", type: "localized", universal: true },
    amenity: { key: "amenity", type: "typeCombo" },
    cuisine: { key: "cuisine", type: "semiCombo", options: ["pizza"] },
    phone: { key: "phone", keys: ["phone", "contact:phone"], type: "tel" },
    outdoor_seating: { key: "outdoor_seating", type: "check" },
    building: { key: "building", type: "combo", label: "{amenity}" },
    address: { key: "addr", type: "address" },
    diet: { key: "diet:", type: "multiCombo" },
    website: { key: "website", type: "url", universal: true },
  },
  deprecated: [
    { old: { amenity: "shop" }, replace: { shop: "*" } },
    { old: { "bicycle:oneway": "*" }, replace: { "oneway:bicycle": "$1" } },
  ],
  strings: [
    {
      presets: {
        "amenity/restaurant": { name: "Gasthaus", terms: "lokal,wirtshaus" },
      },
      fields: { cuisine: { label: "Küche", options: { pizza: "Pizza" } } },
    },
    {
      presets: {
        "amenity/restaurant": { name: "Restaurant" },
        "amenity/cafe": { name: "Cafe" },
      },
      fields: {
        amenity: { label: "Type" },
        cuisine: { label: "Cuisines" },
        outdoor_seating: { label: "Outdoor Seating" },
      },
    },
  ],
};

describe("geometries", () => {
  it("derives geometries without loading nodes", () => {
    expect(geometries({ type: "node" })).toEqual(["point", "vertex"]);
    expect(geometries({ type: "way", nodes: [1, 2, 3] })).toEqual(["line"]);
    expect(geometries({ type: "way", nodes: [1, 2, 3, 1] })).toEqual([
      "area",
      "line",
    ]);
    expect(
      geometries({ type: "relation", tags: { type: "multipolygon" } }),
    ).toEqual(["area", "relation"]);
  });
});

describe("matchPreset", () => {
  it("prefers exact values over wildcards, in the user language", () => {
    const preset = matchPreset(schema, { amenity: "restaurant" }, ["point"]);
    expect(preset).toMatchObject({
      id: "amenity/restaurant",
      name: "Gasthaus",
      icon: "maki-restaurant",
    });
    expect(matchPreset(schema, { amenity: "bar" }, ["point"]).id).toBe(
      "amenity",
    );
  });

  it("respects the geometry and match scores", () => {
    const tags = { building: "yes", amenity: "restaurant" };
    expect(matchPreset(schema, tags, ["area"]).id).toBe("amenity/restaurant");
    expect(matchPreset(schema, { "addr:street": "A" }, ["point"]).id).toBe(
      "address",
    );
  });

  it("falls back to the geometry", () => {
    expect(matchPreset(schema, { foo: "bar" }, ["line"]).id).toBe("line");
    expect(matchPreset(schema, {}, ["vertex"]).id).toBe("point");
  });

  it("ignores no values of wildcards", () => {
    expect(matchPreset(schema, { building: "no" }, ["area"]).id).toBe("area");
  });
});

describe("searchPresets", () => {
  it("finds by name and terms", () => {
    expect(searchPresets(schema, "gast", ["point"]).map((p) => p.id)).toEqual([
      "amenity/restaurant",
    ]);
    expect(searchPresets(schema, "wirts", ["point"])[0].id).toBe(
      "amenity/restaurant",
    );
    expect(searchPresets(schema, "amenity=cafe", ["point"])[0].id).toBe(
      "amenity/cafe",
    );
  });
});

describe("presetFields", () => {
  it("resolves templates, translations and universal fields", () => {
    const { fields, moreFields } = presetFields(
      schema,
      "amenity/restaurant",
      {},
      ["point"],
    );
    expect(fields.map((f) => f.id)).toEqual(["name", "cuisine", "phone"]);
    expect(fields[1]).toMatchObject({
      label: "Küche",
      options: [{ value: "pizza", label: "Pizza" }],
    });
    expect(fields[2].keys).toEqual(["phone", "contact:phone"]);
    expect(moreFields.map((f) => f.id)).toEqual(["outdoor_seating", "website"]);
    expect(moreFields[0].options.map((o) => o.value)).toEqual(["yes", "no"]);
  });

  it("inherits fields of the parent preset, except its type", () => {
    const { fields } = presetFields(schema, "amenity/cafe", {}, ["point"]);
    expect(fields.map((f) => f.id)).toEqual(["name"]);
  });

  it("shares labels with referenced fields", () => {
    const { fields } = presetFields(schema, "building", {}, ["area"]);
    expect(fields[0].label).toBe("Type");
  });
});

describe("fieldMatchesKey", () => {
  const field = (id: string) =>
    presetFields(
      {
        ...schema,
        presets: { x: { tags: {}, geometry: ["point"], fields: [id] } },
      },
      "x",
      {},
      ["point"],
    ).fields[0];

  it("matches keys of composite fields", () => {
    expect(fieldMatchesKey(field("name"), "name")).toBe(true);
    expect(fieldMatchesKey(field("name"), "name:de")).toBe(true);
    expect(fieldMatchesKey(field("name"), "name:etymology")).toBe(false);
    expect(fieldMatchesKey(field("diet"), "diet:vegan")).toBe(true);
    expect(fieldMatchesKey(field("address"), "addr:street")).toBe(true);
    expect(fieldMatchesKey(field("phone"), "contact:phone")).toBe(true);
    expect(fieldMatchesKey(field("phone"), "fax")).toBe(false);
  });
});

describe("deprecations", () => {
  it("finds deprecated tags, also with wildcards", () => {
    expect(deprecations(schema, { amenity: "shop" })).toHaveLength(1);
    expect(deprecations(schema, { "bicycle:oneway": "no" })).toHaveLength(1);
    expect(deprecations(schema, { amenity: "cafe" })).toHaveLength(0);
  });
});

describe("schemaLanguage", () => {
  const available = ["de", "en", "pt-BR", "zh-CN", "zh-TW", "be@tarask"];
  it.each([
    ["de", "de"],
    ["de-at", "de"],
    ["pt-br", "pt-BR"],
    ["zh-hans", "zh-CN"],
    ["zh-hant", "zh-TW"],
    ["be-tarask", "be@tarask"],
    ["xx", undefined],
  ])("%s → %s", (code, expected) => {
    expect(schemaLanguage(code, available)).toBe(expected);
  });
});

describe("humanize and iconUrl", () => {
  it("formats IDs and icon URLs", () => {
    expect(humanize("amenity/fast_food")).toBe("Fast food");
    expect(iconUrl("maki-cafe")).toMatch(/maki@8\/icons\/cafe\.svg$/);
    expect(iconUrl("temaki-bench")).toMatch(/temaki@5\/icons\/bench\.svg$/);
    expect(iconUrl("roentgen-x")).toBeUndefined();
    expect(iconUrl()).toBeUndefined();
  });
});
