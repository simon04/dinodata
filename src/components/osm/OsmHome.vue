<template>
  <section class="dd-osm-home">
    <h1>{{ t("osm-welcome") }}</h1>
    <p class="dd-intro">{{ t("osm-intro") }}</p>

    <form class="dd-osm-home-search" @submit.prevent="submit">
      <cdx-search-input
        v-model="query"
        :placeholder="t('osm-search-placeholder')"
        :aria-label="t('osm-search-placeholder')"
        :button-label="t('osm-search')"
        @submit-click="submit"
      />
      <cdx-button :disabled="locating" @click="nearMe">
        <cdx-icon :icon="cdxIconMapPin" />
        {{ t("osm-nearby") }}
      </cdx-button>
    </form>

    <cdx-progress-bar v-if="busy" inline :aria-label="t('loading')" />
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>

    <template v-if="results">
      <h2>
        {{
          results.kind === "nearby"
            ? t("osm-nearby-results")
            : t("osm-search-results", results.query ?? "")
        }}
      </h2>
      <p v-if="!results.items.length" class="dd-osm-subtle">
        {{ t("search-no-results") }}
      </p>
      <ul class="dd-osm-list">
        <li v-for="item in results.items" :key="`${item.type}${item.id}`">
          <a :href="osmHash(item)">
            <PresetIcon :icon="item.icon" />
            <span class="dd-osm-list-text">
              <span class="dd-osm-list-name">
                {{ item.name }}
                <code class="dd-id-chip">{{ shortRef(item) }}</code>
              </span>
              <span class="dd-osm-subtle">
                {{
                  [item.preset, item.description].filter(Boolean).join(" · ")
                }}
              </span>
            </span>
          </a>
        </li>
      </ul>
    </template>

    <template v-if="recent.length">
      <h2>
        {{ t("osm-recent") }}
        <cdx-button weight="quiet" size="small" @click="clear">
          {{ t("osm-recent-clear") }}
        </cdx-button>
      </h2>
      <ul class="dd-osm-list">
        <li v-for="item in recent" :key="`${item.type}${item.id}`">
          <a :href="osmHash(item)">
            <PresetIcon :icon="item.icon" />
            <span class="dd-osm-list-text">
              <span class="dd-osm-list-name">
                {{ item.name }}
                <code class="dd-id-chip">{{ shortRef(item) }}</code>
              </span>
              <span class="dd-osm-subtle">{{ item.preset }}</span>
            </span>
          </a>
        </li>
      </ul>
    </template>

    <h2>{{ t("app-try") }}</h2>
    <ul class="dd-osm-examples">
      <li v-for="[hash, name] in EXAMPLES" :key="hash">
        <a :href="hash">{{ name }}</a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxMessage,
  CdxProgressBar,
  CdxSearchInput,
} from "@wikimedia/codex";
import { cdxIconMapPin } from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import { formatNumber } from "../../format";
import { searchPlaces } from "../../osm/geocoding";
import {
  osmHash,
  parseLatLon,
  parseOsmRef,
  shortRef,
  type LatLon,
  type OsmRef,
} from "../../osm/osm-ref";
import { getNearby } from "../../osm/overpass";
import {
  geometries,
  matchPreset,
  type Geometry,
  useSchema,
} from "../../osm/presets";
import { useRecent } from "../../osm/recent";
import PresetIcon from "./PresetIcon.vue";

const props = defineProps<{ language: string; search?: string }>();

const EXAMPLES = [
  ["#osm/way/377700239", "Goldenes Dachl, Innsbruck"],
  ["#osm/way/98627547", "Bergisel Ski Jump, Innsbruck"],
  ["#osm/node/256042801", "Serles"],
  ["#osm/relation/4835169", "Innsbruck"],
  ["#osm/node/4163604659", "Café Sacher, Wien"],
  ["#osm/way/5013364", "Eiffel Tower"],
];

const ALL_GEOMETRIES: Geometry[] = ["point", "vertex", "line", "area"];

interface Item extends OsmRef {
  name: string;
  icon?: string;
  preset?: string;
  description?: string;
}

const query = ref(props.search ?? "");
const results = shallowRef<{
  kind: "search" | "nearby";
  query?: string;
  items: Item[];
}>();
const busy = ref(false);
const locating = ref(false);
const error = ref<string>();
const { schema } = useSchema();
const { recent, clear } = useRecent();

function submit() {
  const q = query.value.trim();
  if (!q) return;
  const osmRef = parseOsmRef(q);
  if (osmRef) location.hash = osmHash(osmRef);
  else location.hash = `#osm/search/${encodeURIComponent(q)}`;
}

async function run(task: () => Promise<void>) {
  busy.value = true;
  error.value = undefined;
  try {
    await task();
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}

async function search(q: string) {
  const latLon = parseLatLon(q);
  if (latLon) return showNearby(latLon);
  await run(async () => {
    const places = await searchPlaces(q, props.language);
    results.value = {
      kind: "search",
      query: q,
      items: places.map((p) => {
        const preset =
          schema.value && p.key && p.value
            ? matchPreset(schema.value, { [p.key]: p.value }, ALL_GEOMETRIES)
            : undefined;
        return { ...p, icon: preset?.icon, preset: preset?.name };
      }),
    };
  });
}

const meters = (m: number) =>
  formatNumber(Math.round(m), props.language, {
    style: "unit",
    unit: "meter",
    unitDisplay: "short",
  });

async function showNearby(location: LatLon) {
  await run(async () => {
    const elements = await getNearby(location);
    results.value = {
      kind: "nearby",
      items: elements.map((e) => {
        const tags = e.tags ?? {};
        const preset = schema.value
          ? matchPreset(schema.value, tags, geometries(e))
          : undefined;
        return {
          type: e.type,
          id: e.id,
          name:
            tags[`name:${props.language}`] ??
            tags.name ??
            tags.ref ??
            preset?.name ??
            `${e.type} ${e.id}`,
          icon: preset?.icon,
          preset: preset?.name,
          description: meters(e.distance),
        };
      }),
    };
  });
}

function nearMe() {
  locating.value = true;
  error.value = undefined;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false;
      showNearby({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
    },
    (e) => {
      locating.value = false;
      error.value = t("osm-nearby-failed", e.message);
    },
    { enableHighAccuracy: true, timeout: 15000 },
  );
}

watch(
  () => props.search,
  (q) => {
    if (q) {
      query.value = q;
      search(q);
    } else results.value = undefined;
  },
  { immediate: true },
);
</script>

<style scoped>
.dd-osm-home {
  max-width: 48rem;
}
.dd-osm-home h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1em;
  margin: 1.5rem 0 0.5rem;
}
.dd-osm-home-search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}
.dd-osm-home-search .cdx-search-input {
  flex: 1;
  min-width: 14rem;
}
.dd-osm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}
.dd-osm-list li + li {
  border-top: 1px solid var(--border-color-subtle);
}
.dd-osm-list a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  /* large touch targets */
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  color: inherit;
  text-decoration: none;
}
.dd-osm-list a:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-osm-list .dd-preset-icon {
  font-size: 1.25em;
  color: var(--color-subtle);
}
.dd-osm-list-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dd-osm-list-name {
  color: var(--color-progressive);
}
.dd-osm-subtle {
  color: var(--color-subtle);
  font-size: 0.875em;
}
.dd-osm-examples li + li {
  margin-top: 0.5rem;
}
</style>
