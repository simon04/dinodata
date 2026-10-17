<template>
  <div class="dd-value-picker">
    <form @submit.prevent="submit">
      <cdx-text-input
        ref="input"
        v-model="query"
        :input-type="inputType"
        :placeholder="placeholder ?? t('osm-value-placeholder')"
        :aria-label="placeholder ?? t('osm-value-placeholder')"
        :start-icon="items.length > 3 ? cdxIconSearch : undefined"
        clearable
        enterkeyhint="done"
        autocapitalize="off"
      />
    </form>
    <ul v-if="items.length" class="dd-value-list" role="listbox">
      <li
        v-for="item in items"
        :key="item.value"
        role="option"
        :aria-selected="selectedValues.includes(item.value)"
      >
        <button
          class="dd-value-item"
          :class="{
            'dd-value-item--selected': selectedValues.includes(item.value),
          }"
          @click="choose(item.value)"
        >
          <cdx-icon
            class="dd-value-check"
            :icon="
              selectedValues.includes(item.value) ? cdxIconCheck : cdxIconAdd
            "
            size="small"
          />
          <span class="dd-value-text">
            <span class="dd-value-label">
              <template v-if="item.custom">
                {{ t("osm-value-use", item.value) }}
              </template>
              <template v-else>
                {{ item.label }}
                <code v-if="item.label !== item.value">{{ item.value }}</code>
              </template>
            </span>
            <span v-if="item.description" class="dd-value-description">
              {{ item.description }}
            </span>
          </span>
          <span v-if="item.count" class="dd-value-count">
            {{ compact(item.count) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import { CdxIcon, CdxTextInput } from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconCheck,
  cdxIconSearch,
} from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import { formatNumber } from "../../format";
import { getValues, type ValueStat } from "../../osm/taginfo";
import type { FieldOption } from "../../osm/presets";
import { joinValues, normalizeValue, splitValues } from "../../osm/tags";

/**
 * Pick a value: the options of the preset field (translated), the most used
 * values from taginfo, or a free value. With `multi`, values are toggled
 * in a `;`-separated list.
 */
const props = withDefaults(
  defineProps<{
    tagKey: string;
    value?: string;
    options?: FieldOption[];
    multi?: boolean;
    customValues?: boolean;
    placeholder?: string;
    inputType?: "text" | "number" | "tel" | "email" | "url";
    language: string;
  }>(),
  { options: () => [], customValues: true, inputType: "text" },
);
const emit = defineEmits<{
  /** new value; `done` when a single value was chosen */
  update: [value: string | undefined, done: boolean];
}>();

const initial = props.multi ? "" : (props.value ?? "");
const query = ref(initial);
const stats = shallowRef<ValueStat[]>([]);
const input = useTemplateRef<InstanceType<typeof CdxTextInput>>("input");

const selectedValues = computed(() =>
  props.multi ? splitValues(props.value) : props.value ? [props.value] : [],
);

onMounted(() => {
  getValues(props.tagKey, props.language)
    .then((s) => (stats.value = s))
    .catch(console.warn);
  // keyboard right away on desktop; on phones the options come first
  if (!matchMedia("(pointer: coarse)").matches || !props.options.length)
    input.value?.focus();
});

const compact = (n: number) =>
  formatNumber(n, props.language, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const items = computed(() => {
  // the current value as query does not filter
  const q = query.value === initial ? "" : query.value.trim().toLowerCase();
  const counts = new Map(stats.value.map((s) => [s.value, s]));
  const all: {
    value: string;
    label: string;
    description?: string;
    count?: number;
    custom?: boolean;
  }[] = props.options.map((o) => ({
    ...o,
    description: o.description ?? counts.get(o.value)?.description,
    count: counts.get(o.value)?.count,
  }));
  if (props.customValues)
    for (const s of stats.value)
      if (!all.some((i) => i.value === s.value) && !s.value.includes(";"))
        all.push({ ...s, label: s.value });
  // current values first, also when not among the suggestions
  for (const v of [...selectedValues.value].reverse()) {
    const i = all.findIndex((item) => item.value === v);
    all.unshift(i >= 0 ? all.splice(i, 1)[0] : { value: v, label: v });
  }
  const filtered = q
    ? all.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.value.toLowerCase().includes(q),
      )
    : all;
  const typed = normalizeValue(query.value);
  if (props.customValues && typed && q && !all.some((i) => i.value === typed))
    filtered.unshift({ value: typed, label: typed, custom: true });
  return filtered.slice(0, 60);
});

function choose(value: string) {
  if (props.multi) {
    const values = selectedValues.value;
    emit(
      "update",
      joinValues(
        values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      ),
      false,
    );
    query.value = "";
  } else emit("update", value, true);
}

function submit() {
  const typed = normalizeValue(query.value);
  if (props.multi) {
    if (typed && !selectedValues.value.includes(typed)) choose(typed);
    else emit("update", props.value, true);
  } else emit("update", typed, true);
}

defineExpose({
  /** apply the typed value, e.g. from a "Done" button */
  submit,
});
</script>

<style scoped>
.dd-value-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}
.dd-value-item {
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
.dd-value-item:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-value-item:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
}
.dd-value-item--selected {
  background: var(--background-color-progressive-subtle);
}
.dd-value-check {
  color: var(--color-subtle);
}
.dd-value-item--selected .dd-value-check {
  color: var(--color-progressive);
}
.dd-value-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dd-value-label code {
  margin-inline-start: 0.35rem;
  color: var(--color-subtle);
}
.dd-value-description {
  color: var(--color-subtle);
  font-size: 0.8125em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.dd-value-count {
  color: var(--color-subtle);
  font-size: 0.8125em;
  white-space: nowrap;
}
</style>
