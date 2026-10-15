<template>
  <span v-if="snak.snaktype === 'novalue'" class="dd-special">no value</span>
  <span v-else-if="snak.snaktype === 'somevalue'" class="dd-special">
    unknown value
  </span>
  <a v-else-if="entityId" :href="`#${entityId}`" :title="entityId">
    {{ labels[entityId] ?? entityId }}
  </a>
  <a v-else-if="href" :href="href" target="_blank" rel="external noopener">
    {{ text }}
  </a>
  <span v-else>{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Snak } from "../wikidata";

const props = defineProps<{
  snak: Snak;
  labels: Record<string, string>;
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatTime(time: string, precision: number): string {
  const m = time.match(/^([+-])0*(\d+)-(\d\d)-(\d\d)/);
  if (!m) return time;
  const [, sign, year, month, day] = m;
  const era = sign === "-" ? " BCE" : "";
  if (precision >= 11) return `${+day} ${MONTHS[+month - 1]} ${year}${era}`;
  if (precision === 10) return `${MONTHS[+month - 1]} ${year}${era}`;
  if (precision === 9) return `${year}${era}`;
  if (precision === 8) return `${year}s${era}`;
  if (precision === 7) return `${Math.floor(+year / 100) + 1}th century${era}`;
  if (precision === 6)
    return `${Math.floor(+year / 1000) + 1}th millennium${era}`;
  return `${year} years${era}`;
}

const text = computed(() => {
  const v = value.value as Record<string, string> | string | undefined;
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  switch (props.snak.datavalue?.type) {
    case "time":
      return formatTime(v.time, Number(v.precision));
    case "quantity": {
      const unit = v.unit?.match(/Q\d+$/)?.[0];
      const amount = Number(v.amount).toLocaleString();
      const bound =
        v.upperBound !== undefined
          ? ` ±${Number(v.upperBound) - Number(v.amount)}`
          : "";
      return unit
        ? `${amount}${bound} ${props.labels[unit] ?? unit}`
        : `${amount}${bound}`;
    }
    case "monolingualtext":
      return `${v.text} (${v.language})`;
    case "globecoordinate":
      return `${Number(v.latitude).toFixed(4)}°, ${Number(v.longitude).toFixed(4)}°`;
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
