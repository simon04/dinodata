<template>
  <span>
    <span v-if="snak.snaktype === 'novalue'" class="dd-special">
      {{ t("snak-novalue") }}
    </span>
    <span v-else-if="snak.snaktype === 'somevalue'" class="dd-special">
      {{ t("snak-somevalue") }}
    </span>
    <template v-else-if="entityId">
      <a :href="`#${entityId}`" v-tooltip="descriptions?.[entityId]">
        {{ labels[entityId] ?? entityId }}
      </a>
      <EntityId :id="entityId" />
    </template>
    <a v-else-if="href" :href="href" target="_blank" rel="external noopener">
      {{ text }}
    </a>
    <span v-else>{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { language, t } from "../i18n";
import { computed } from "vue";
import type { Snak } from "../wikidata";
import EntityId from "./EntityId.vue";
import { formatNumber, formatTime } from "../format";

const props = defineProps<{
  snak: Snak;
  labels: Record<string, string>;
  descriptions?: Record<string, string>;
  formatterUrls?: Record<string, string>;
}>();

const value = computed(() => props.snak.datavalue?.value);

const entityId = computed(() =>
  props.snak.datavalue?.type === "wikibase-entityid"
    ? (value.value as { id: string }).id
    : undefined,
);

const href = computed(() => {
  const v = value.value;
  switch (props.snak.datatype) {
    case "url":
      return String(v);
    case "commonsMedia":
      return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(v))}`;
    case "external-id": {
      const formatter = props.formatterUrls?.[props.snak.property];
      return formatter?.replace("$1", encodeURIComponent(String(v)));
    }
    case "globe-coordinate": {
      const { latitude, longitude } = v as Record<string, number>;
      return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`;
    }
  }
  return undefined;
});

const text = computed(() => {
  const v = value.value as Record<string, string> | string | undefined;
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  switch (props.snak.datavalue?.type) {
    case "time":
      return formatTime(v.time, Number(v.precision), language.value);
    case "quantity": {
      const unit = v.unit?.match(/Q\d+$/)?.[0];
      const amount = formatNumber(v.amount, language.value);
      const bound =
        v.upperBound !== undefined
          ? ` ±${formatNumber(Number(v.upperBound) - Number(v.amount), language.value, { maximumSignificantDigits: 15 })}`
          : "";
      return unit
        ? `${amount}${bound} ${props.labels[unit] ?? unit}`
        : `${amount}${bound}`;
    }
    case "monolingualtext":
      return `${v.text} (${v.language})`;
    case "globecoordinate":
      const coordinate = (c: string) =>
        formatNumber(c, language.value, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });
      return `${coordinate(v.latitude)}°, ${coordinate(v.longitude)}°`;
  }
  return JSON.stringify(v);
});
</script>

<style scoped>
.dd-special {
  font-style: italic;
  color: var(--color-subtle);
}
</style>
