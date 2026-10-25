<template>
  <EntitySearch
    v-if="entityType"
    ref="input"
    :language="language"
    :type="entityType"
    :placeholder="
      entityType === 'item' ? t('search-item') : t('search-property')
    "
    @select="onEntity"
    @keydown.esc.capture="onEscape"
  />
  <cdx-field
    v-else
    class="dd-value-input"
    :status="showError ? 'error' : 'default'"
    :messages="{ error: t('value-invalid', placeholder) }"
    :hide-label="true"
    @keydown.esc.capture="onEscape"
  >
    <template #label>{{ label ?? t("value-placeholder") }}</template>
    <div class="dd-value-row">
      <cdx-text-input
        ref="input"
        v-model="text"
        :placeholder="placeholder"
        :status="showError ? 'error' : 'default'"
        @keydown.enter="submit"
        @blur="touched = true"
      />
      <cdx-text-input
        v-if="datatype === 'monolingualtext'"
        v-model="textLanguage"
        class="dd-lang"
        :aria-label="t('value-language-code')"
        @keydown.enter="submit"
      />
      <cdx-button action="progressive" :disabled="empty" @click="submit">
        {{ original ? t("save") : t("add") }}
      </cdx-button>
    </div>
  </cdx-field>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { CdxButton, CdxField, CdxTextInput } from "@wikimedia/codex";
import type { Snak } from "../wikidata";
import EntitySearch from "./EntitySearch.vue";
import { formatInput, keepOriginal, parseValue } from "../values";

const props = defineProps<{
  property: string;
  datatype: string;
  language: string;
  /** value being edited: prefills the input, see {@link keepOriginal} */
  original?: Snak;
  /** accessible label, e.g. the property label */
  label?: string;
}>();
const emit = defineEmits<{
  submit: [snak: Snak, label?: string];
  cancel: [];
}>();

/**
 * Escape cancels, unless it closes an open suggestion menu. Captured, as
 * Codex menus stop the propagation of Escape even when collapsed.
 */
function onEscape(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (target.getAttribute("aria-expanded") === "true") return;
  emit("cancel");
}

const text = ref(formatInput(props.original?.datavalue));
const textLanguage = ref(
  (props.original?.datavalue?.value as { language?: string })?.language ??
    props.language,
);
const input = useTemplateRef<{ $el: HTMLElement }>("input");

const entityType = computed(() =>
  props.datatype === "wikibase-item"
    ? "item"
    : props.datatype === "wikibase-property"
      ? "property"
      : undefined,
);

const placeholder = computed(() => {
  switch (props.datatype) {
    case "time":
      return t("value-placeholder-time");
    case "quantity":
      return t("value-placeholder-quantity");
    case "globe-coordinate":
      return t("value-placeholder-coordinate");
    case "url":
      return t("value-placeholder-url");
    case "commonsMedia":
      return t("value-placeholder-commons");
  }
  return t("value-placeholder");
});

function datavalue(): Snak["datavalue"] {
  if (props.datatype === "monolingualtext" && !textLanguage.value) return;
  return keepOriginal(
    parseValue(props.datatype, text.value, textLanguage.value),
    props.original?.datavalue,
    text.value,
  );
}

const snak = computed<Snak | undefined>(() => {
  const dv = datavalue();
  return dv
    ? {
        snaktype: "value",
        property: props.property,
        datatype: props.datatype,
        datavalue: dv,
      }
    : undefined;
});

const empty = computed(() => !text.value.trim());
/** Validate on blur and on submit, not while typing; empty is not an error. */
const touched = ref(false);
const showError = computed(() => touched.value && !empty.value && !snak.value);

function submit() {
  if (empty.value) return;
  touched.value = true;
  if (!snak.value) return;
  touched.value = false;
  emit("submit", snak.value);
  text.value = "";
}

function onEntity(id: string, label: string) {
  emit(
    "submit",
    {
      snaktype: "value",
      property: props.property,
      datatype: props.datatype,
      datavalue: {
        type: "wikibase-entityid",
        value: { "entity-type": entityType.value, id },
      },
    },
    label,
  );
}

function focus() {
  input.value?.$el.querySelector("input")?.focus();
}

onMounted(focus);
defineExpose({ focus });
</script>

<style scoped>
/*
 * Codex spaces fields below preceding siblings, here it sits in a row
 * (more specific than Codex's bidi "[dir] .cdx-field")
 */
.dd-value-input.cdx-field {
  margin-top: 0;
}
.dd-value-row {
  display: flex;
  gap: 0.5rem;
}
.dd-value-row > :first-child {
  flex: 1;
}

.dd-lang {
  width: 5rem;
  min-width: 5rem;
}
</style>
