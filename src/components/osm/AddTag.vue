<template>
  <div class="dd-add-tag">
    <template v-if="key === undefined">
      <form @submit.prevent="submitKey">
        <cdx-text-input
          ref="input"
          v-model="query"
          :placeholder="t('osm-add-placeholder')"
          :aria-label="t('osm-add-placeholder')"
          :start-icon="cdxIconSearch"
          autocapitalize="off"
          enterkeyhint="next"
          @update:model-value="searchKeys"
        />
      </form>
      <ul class="dd-add-list">
        <li v-for="field in matchingFields" :key="field.id">
          <button
            type="button"
            class="dd-add-item"
            @click="emit('field', field.id)"
          >
            <cdx-icon :icon="cdxIconAdd" size="small" />
            <span class="dd-add-text">
              {{ field.label }}
              <code>{{ field.key ?? field.keys[0] }}</code>
            </span>
          </button>
        </li>
        <li v-for="stat in keyStats" :key="stat.key">
          <button type="button" class="dd-add-item" @click="key = stat.key">
            <cdx-icon :icon="cdxIconAdd" size="small" />
            <span class="dd-add-text">
              <code>{{ stat.key }}</code>
            </span>
            <span class="dd-add-count">{{ compact(stat.count) }}</span>
          </button>
        </li>
      </ul>
    </template>
    <template v-else>
      <p class="dd-add-key">
        <code>{{ key }}</code>
        <cdx-button weight="quiet" size="small" @click="key = undefined">
          {{ t("osm-add-other-key") }}
        </cdx-button>
      </p>
      <ValuePicker
        :tag-key="key"
        :options="keyField?.options"
        :custom-values="true"
        :language="language"
        @update="
          (value, done) => done && value && emit('patch', { [key!]: value })
        "
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { CdxButton, CdxIcon, CdxTextInput } from "@wikimedia/codex";
import { cdxIconAdd, cdxIconSearch } from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import { formatNumber } from "../../format";
import { fieldForKey, type Field, type Schema } from "../../osm/presets";
import { searchKeys as taginfoKeys, type KeyStat } from "../../osm/taginfo";
import { parseTagText, type TagPatch } from "../../osm/tags";
import ValuePicker from "./ValuePicker.vue";

/**
 * Add a field of the preset or any tag: key from the preset's more fields or
 * taginfo, then the value. `key=value` lines can be typed directly.
 */
const props = defineProps<{
  schema?: Schema;
  /** more fields of the preset, not shown yet */
  fields: Field[];
  language: string;
}>();
const emit = defineEmits<{
  field: [id: string];
  patch: [patch: TagPatch];
}>();

const query = ref("");
const key = ref<string>();
const keyStats = shallowRef<KeyStat[]>([]);
const input = useTemplateRef<InstanceType<typeof CdxTextInput>>("input");

onMounted(() => input.value?.focus());

const compact = (n: number) =>
  formatNumber(n, props.language, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const matchingFields = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.fields.filter(
    (f) =>
      !q ||
      f.label.toLowerCase().includes(q) ||
      f.keys.some((k) => k.includes(q)),
  );
});

const keyField = computed(() =>
  props.schema && key.value ? fieldForKey(props.schema, key.value) : undefined,
);

const searchKeys = useDebounceFn(async (value: string) => {
  const q = value.trim();
  if (q.length < 2 || q.includes("=")) {
    keyStats.value = [];
    return;
  }
  const stats = await taginfoKeys(q).catch(() => []);
  if (q === query.value.trim()) keyStats.value = stats;
}, 250);

function submitKey() {
  const q = query.value.trim();
  if (!q) return;
  if (q.includes("=")) {
    const { tags } = parseTagText(q);
    if (Object.keys(tags).length) emit("patch", tags);
    return;
  }
  key.value = q;
}
</script>

<style scoped>
.dd-add-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}
.dd-add-item {
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
.dd-add-item:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-add-item:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
}
.dd-add-text {
  flex: 1;
}
.dd-add-text code {
  margin-inline-start: 0.35rem;
  color: var(--color-subtle);
}
.dd-add-text code:first-child {
  margin: 0;
  color: inherit;
}
.dd-add-count {
  color: var(--color-subtle);
  font-size: 0.8125em;
}
.dd-add-key {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
}
</style>
