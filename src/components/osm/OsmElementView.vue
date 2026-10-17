<template>
  <EntitySkeleton v-if="loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article v-else-if="element" class="dd-osm">
    <header class="dd-osm-header">
      <div class="dd-osm-title">
        <p class="dd-osm-preset">
          <PresetIcon :icon="preset?.icon" />
          {{ preset?.name ?? t("loading") }}
        </p>
        <h1>
          {{ title }}
          <EntityId :id="shortRef(osmRef)" />
        </h1>
        <p class="dd-osm-meta">
          {{
            t(
              "osm-last-edit",
              formatRelativeTime(element.timestamp, language),
              element.user ?? "?",
              element.version,
            )
          }}
        </p>
        <p class="dd-osm-links">
          <a
            :class="LINK_BUTTON"
            :href="elementUrl(osmRef)"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconMapPin" size="small" />
            {{ t("osm-openstreetmap") }}
          </a>
          <a
            :class="LINK_BUTTON"
            :href="editUrl(osmRef)"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconEdit" size="small" />
            iD
          </a>
          <a v-if="wikidataId" :class="LINK_BUTTON" :href="`#${wikidataId}`">
            <cdx-icon :icon="cdxIconLogoWikidata" size="small" />
            {{ t("entity-wikidata") }}
          </a>
        </p>
      </div>
      <StaticMap
        v-if="bounds"
        class="dd-osm-map"
        :bounds="bounds"
        :href="elementUrl(osmRef)"
      />
    </header>

    <section>
      <h2>{{ t("osm-tags", Object.keys(tags).length) }}</h2>
      <ul class="dd-tags">
        <TagRow
          v-for="(value, key) in tags"
          :key="key"
          :tag-key="key"
          :value="value"
          :value-label="optionLabel(key, value)"
          :description="
            docs[`${key}=${value}`]?.description ?? docs[key]?.description
          "
          :discouraged="
            docs[`${key}=${value}`]?.discouraged || docs[key]?.discouraged
          "
          @open="selected = key"
        />
      </ul>
    </section>

    <BottomSheet
      :open="selected !== undefined"
      :title="selected"
      @update:open="(open) => !open && (selected = undefined)"
    >
      <TagInfo
        v-if="selected !== undefined"
        :tag-key="selected"
        :value="tags[selected]"
        :key-doc="docs[selected]"
        :value-doc="docs[`${selected}=${tags[selected]}`]"
        :item-labels="itemLabels"
      />
    </BottomSheet>

    <section v-if="parents.length">
      <h2>{{ t("osm-part-of") }}</h2>
      <ul class="dd-osm-parents">
        <li v-for="parent in parents" :key="`${parent.type}${parent.id}`">
          <a :href="osmHash(parent)">
            <PresetIcon :icon="presetOf(parent)?.icon" />
            {{ elementTitle(parent) }}
          </a>
          <code class="dd-id-chip">{{ shortRef(parent) }}</code>
          <span class="dd-osm-subtle">{{ presetOf(parent)?.name }}</span>
        </li>
      </ul>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useTitle } from "@vueuse/core";
import { CdxIcon, CdxMessage } from "@wikimedia/codex";
import {
  cdxIconEdit,
  cdxIconLogoWikidata,
  cdxIconMapPin,
} from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import { formatRelativeTime } from "../../format";
import {
  editUrl,
  elementUrl,
  getBounds,
  getElement,
  getParents,
  type OsmElement,
  type Tags,
} from "../../osm/osm";
import type { Bounds } from "../../osm/geocoding";
import { osmHash, shortRef, type OsmRef } from "../../osm/osm-ref";
import {
  fieldMatchesKey,
  geometries,
  matchPreset,
  presetFields,
  useSchema,
} from "../../osm/presets";
import { useTagDocs } from "../../osm/osmwiki";
import { useRecent } from "../../osm/recent";
import EntityId from "../EntityId.vue";
import EntitySkeleton from "../EntitySkeleton.vue";
import PresetIcon from "./PresetIcon.vue";
import StaticMap from "./StaticMap.vue";
import BottomSheet from "./BottomSheet.vue";
import TagInfo from "./TagInfo.vue";
import TagRow from "./TagRow.vue";

const props = defineProps<{ osmRef: OsmRef; language: string }>();

/** Codex link styled as a button ("fake button") */
const LINK_BUTTON = [
  "cdx-button",
  "cdx-button--fake-button",
  "cdx-button--fake-button--enabled",
];

const element = shallowRef<OsmElement>();
const parents = shallowRef<OsmElement[]>([]);
const bounds = shallowRef<Bounds>();
const loading = ref(false);
const error = ref<string>();

const { schema } = useSchema();
const tags = computed<Tags>(() => element.value?.tags ?? {});

const preset = computed(() =>
  schema.value && element.value
    ? matchPreset(schema.value, tags.value, geometries(element.value))
    : undefined,
);

/** Fields of the preset, for translated labels of values. */
const fields = computed(() => {
  const e = element.value;
  if (!schema.value || !e || !preset.value) return [];
  const { fields, moreFields } = presetFields(
    schema.value,
    preset.value.id,
    tags.value,
    geometries(e),
  );
  return [...fields, ...moreFields];
});

/** Translated option of the field editing the key, e.g. "Asphalt". */
function optionLabel(key: string, value: string): string | undefined {
  const field = fields.value.find((f) => fieldMatchesKey(f, key));
  return field?.options.find((o) => o.value === value)?.label;
}

const { docs, itemLabels, load: loadDocs } = useTagDocs(() => props.language);
watch([tags, () => props.language], () => {
  loadDocs(tags.value).catch(console.warn);
});
const selected = ref<string>();

function presetOf(e: OsmElement) {
  return schema.value
    ? matchPreset(schema.value, e.tags ?? {}, geometries(e))
    : undefined;
}

/** Name in the user language, else name, ref, or the type and ID. */
function elementTitle(e: OsmElement): string {
  const tags = e.tags ?? {};
  return (
    tags[`name:${props.language}`] ??
    tags.name ??
    tags.ref ??
    presetOf(e)?.name ??
    `${e.type} ${e.id}`
  );
}

const title = computed(() =>
  element.value ? elementTitle(element.value) : "",
);

const wikidataId = computed(() =>
  tags.value.wikidata?.match(/^Q\d+$/) ? tags.value.wikidata : undefined,
);

// remembered for the OSM home page, once the preset is known
const { add: addRecent } = useRecent();
watch(preset, (p) => {
  if (p && element.value)
    addRecent({
      type: element.value.type,
      id: element.value.id,
      name: title.value,
      icon: p.icon,
      preset: p.name,
    });
});

// restores "DinoData" on unmount
useTitle(
  computed(() =>
    [shortRef(props.osmRef), title.value, "DinoData"]
      .filter(Boolean)
      .join(" · "),
  ),
);

watch(
  () => [props.osmRef.type, props.osmRef.id],
  async () => {
    const osmRef = props.osmRef;
    loading.value = true;
    error.value = undefined;
    parents.value = [];
    bounds.value = undefined;
    try {
      const e = await getElement(osmRef);
      if (props.osmRef !== osmRef) return;
      element.value = e;
      loading.value = false;
      getBounds(e)
        .then((b) => props.osmRef === osmRef && (bounds.value = b))
        .catch(console.warn);
      getParents(osmRef)
        .then((p) => props.osmRef === osmRef && (parents.value = p))
        .catch(console.warn);
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.dd-osm-header {
  display: flex;
  gap: 1rem 2rem;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.dd-osm-title {
  min-width: 0;
}
.dd-osm h1 {
  margin: 0.25rem 0;
  overflow-wrap: anywhere;
}
.dd-osm-preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.1em;
  color: var(--color-subtle);
}
.dd-osm-meta {
  margin: 0 0 0.5rem;
  color: var(--color-subtle);
  font-size: 0.875em;
}
.dd-osm-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0;
}
.dd-osm-map {
  flex: 0 0 22rem;
}
.dd-osm h2 {
  font-size: 1.1em;
  margin: 1.5rem 0 0.5rem;
}
.dd-tags {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}
.dd-osm-parents {
  margin: 0;
  padding-inline-start: 0;
  list-style: none;
}
.dd-osm-parents li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem 0;
}
.dd-osm-parents a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.dd-osm-subtle {
  color: var(--color-subtle);
  margin-inline-start: 0.25rem;
}
@media (max-width: 640px) {
  .dd-osm-header {
    flex-direction: column-reverse;
    align-items: stretch;
  }
  .dd-osm-map {
    flex-basis: auto;
  }
}
</style>
