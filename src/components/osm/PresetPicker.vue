<template>
  <div class="dd-preset-picker">
    <cdx-search-input
      ref="input"
      v-model="query"
      :placeholder="t('osm-preset-search')"
      :aria-label="t('osm-preset-search')"
    />
    <ul class="dd-preset-list">
      <li v-for="preset in presets" :key="preset.id">
        <button
          type="button"
          class="dd-preset-item"
          :aria-pressed="preset.id === current"
          @click="emit('select', preset.id)"
        >
          <PresetIcon :icon="preset.icon" />
          <span class="dd-preset-text">
            {{ preset.name }}
            <code>{{ tagText(preset.tags) }}</code>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { CdxSearchInput } from "@wikimedia/codex";
import { t } from "../../i18n";
import type { Tags } from "../../osm/osm";
import { searchPresets, type Geometry, type Schema } from "../../osm/presets";
import PresetIcon from "./PresetIcon.vue";

/** Change what the object is: search presets by name, term or tag. */
const props = defineProps<{
  schema: Schema;
  geometry: Geometry[];
  current?: string;
}>();
const emit = defineEmits<{ select: [presetId: string] }>();

const query = ref("");
const input = useTemplateRef<InstanceType<typeof CdxSearchInput>>("input");
onMounted(() => {
  if (!matchMedia("(pointer: coarse)").matches) input.value?.focus();
});

const presets = computed(() =>
  searchPresets(props.schema, query.value, props.geometry, 40),
);

const tagText = (tags: Tags) =>
  Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join(" + ");
</script>

<style scoped>
.dd-preset-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}
.dd-preset-item {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--border-radius-base);
  cursor: pointer;
}
.dd-preset-item:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-preset-item:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
}
.dd-preset-item[aria-pressed="true"] {
  background: var(--background-color-progressive-subtle);
}
.dd-preset-item .dd-preset-icon {
  font-size: 1.25em;
  color: var(--color-subtle);
}
.dd-preset-text code {
  display: block;
  color: var(--color-subtle);
  overflow-wrap: anywhere;
}
</style>
