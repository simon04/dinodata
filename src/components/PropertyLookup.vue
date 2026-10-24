<template>
  <cdx-lookup
    :aria-label="t('search-property')"
    ref="lookup"
    v-model:selected="selected"
    v-model:input-value="inputValue"
    :menu-items="menuItems"
    :menu-config="{ visibleItemLimit: 8 }"
    :placeholder="loading ? t('property-loading') : t('property-placeholder')"
    @input="onInput"
    @update:selected="onSelected"
  >
    <template #no-results>{{ t("property-no-results") }}</template>
  </cdx-lookup>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { onMounted, ref, useTemplateRef } from "vue";
import { CdxLookup, type MenuItemData } from "@wikimedia/codex";
import {
  propertyDescription,
  propertyLabel,
  searchProperties,
  useProperties,
  type Property,
} from "../properties";

const props = defineProps<{
  language: string;
  autofocus?: boolean;
  /** property IDs offered before typing */
  suggestions?: string[];
  /** labels of the suggestions, until all properties are loaded */
  labels?: Record<string, string>;
}>();
const emit = defineEmits<{ select: [property: Property] }>();

const { byId, loading } = useProperties();
const selected = ref<string | null>(null);
const inputValue = ref("");
const toMenuItem = (p: Property): MenuItemData => ({
  value: p.id,
  label: propertyLabel(p, props.language) ?? props.labels?.[p.id] ?? p.id,
  match: `${p.id} · ${p.datatype}`,
  description: propertyDescription(p, props.language),
});

const menuItems = ref<MenuItemData[]>(suggestionItems());
const lookup = useTemplateRef<{ $el: HTMLElement }>("lookup");

/** The suggestions, shown by Codex on focus if present when mounted. */
function suggestionItems(): MenuItemData[] {
  return (props.suggestions ?? []).flatMap((id) =>
    byId.value[id] ? [toMenuItem(byId.value[id])] : [],
  );
}

function onInput(value: string) {
  menuItems.value = value.trim()
    ? searchProperties(value).map(toMenuItem)
    : suggestionItems();
}

function onSelected(id: string | null) {
  const property = id ? byId.value[id] : undefined;
  if (property) emit("select", property);
}

function reset() {
  selected.value = null;
  inputValue.value = "";
  menuItems.value = suggestionItems();
  focus();
}

function focus() {
  lookup.value?.$el.querySelector("input")?.focus();
}

onMounted(() => props.autofocus && focus());
defineExpose({ focus, reset });
</script>
