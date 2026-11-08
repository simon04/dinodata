<template>
  <div class="dd-nearby">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <cdx-progress-indicator v-else-if="loading" show-label>
      {{ t("backlinks-loading") }}
    </cdx-progress-indicator>
    <p v-else-if="!items.length">{{ t("nearby-none") }}</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id">
        <a :href="`#${item.id}`">{{ item.label ?? item.id }}</a>
        <EntityId :id="item.id" />
        <span class="dd-nearby-description">
          {{
            [meters(item.distance), item.description]
              .filter(Boolean)
              .join(" · ")
          }}
        </span>
      </li>
    </ul>
    <p class="dd-nearby-actions">
      <a
        :href="`https://www.wikidata.org/wiki/Special:Nearby#/coord/${location.lat},${location.lon}`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("nearby-wikidata") }}
      </a>
      <a :href="mapHash({ ...location, zoom: 17 })">
        {{ t("nearby-osm") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { t } from "../i18n";
import { formatNumber } from "../format";
import { mapHash, type LatLon } from "../osm/osm-ref";
import { getNearbyItems, type NearbyItem } from "../wikidata";
import EntityId from "./EntityId.vue";

/** Items with coordinates near the item, nearest first. */
const props = defineProps<{ id: string; location: LatLon; language: string }>();

const result = ref<NearbyItem[]>([]);
const loading = ref(true);
const error = ref<string>();
/** without the item itself */
const items = computed(() => result.value.filter((i) => i.id !== props.id));

const meters = (m: number) =>
  m < 1000
    ? formatNumber(Math.round(m), props.language, {
        style: "unit",
        unit: "meter",
        unitDisplay: "short",
      })
    : formatNumber(m / 1000, props.language, {
        style: "unit",
        unit: "kilometer",
        unitDisplay: "short",
        maximumFractionDigits: 1,
      });

getNearbyItems(props.location, props.language)
  .then((r) => (result.value = r))
  .catch((e) => (error.value = String(e)))
  .finally(() => (loading.value = false));
</script>

<style scoped>
.dd-nearby ul {
  margin: 1rem 0 0;
  padding-inline-start: 1.25rem;
}
.dd-nearby li + li {
  margin-top: 0.25rem;
}
.dd-nearby-description {
  color: var(--color-subtle);
  margin-inline-start: 0.25rem;
}
.dd-nearby-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
