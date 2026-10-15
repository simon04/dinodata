<template>
  <span v-if="snak.snaktype === 'novalue'" class="dd-special">no value</span>
  <span v-else-if="snak.snaktype === 'somevalue'" class="dd-special">
    unknown value
  </span>
  <a v-else-if="entityId" :href="`#${entityId}`" :title="entityId">
    {{ labels[entityId] ?? entityId }}
  </a>
  <a
    v-else-if="snak.datatype === 'url'"
    :href="String(value)"
    target="_blank"
    rel="external noopener"
  >
    {{ value }}
  </a>
  <a
    v-else-if="snak.datatype === 'commonsMedia'"
    :href="`https://commons.wikimedia.org/wiki/File:${value}`"
    target="_blank"
    rel="external noopener"
  >
    {{ value }}
  </a>
  <span v-else>{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Snak } from "../wikidata";

const props = defineProps<{ snak: Snak; labels: Record<string, string> }>();

const value = computed(() => props.snak.datavalue?.value);

const entityId = computed(() =>
  props.snak.datavalue?.type === "wikibase-entityid"
    ? (value.value as { id: string }).id
    : undefined,
);

const text = computed(() => {
  const v = value.value as Record<string, string> | string | undefined;
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  switch (props.snak.datavalue?.type) {
    case "time":
      return v.time.replace(/^\+/, "").replace(/T.*$/, "").replace(/-00/g, "");
    case "quantity": {
      const unit = v.unit?.replace(/^.*\//, "");
      const amount = v.amount.replace(/^\+/, "");
      return unit && unit !== "1"
        ? `${amount} ${props.labels[unit] ?? unit}`
        : amount;
    }
    case "monolingualtext":
      return `${v.text} (${v.language})`;
    case "globecoordinate":
      return `${v.latitude}, ${v.longitude}`;
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
