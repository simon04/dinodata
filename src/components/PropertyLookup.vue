<template>
  <cdx-lookup
    ref="lookup"
    v-model:selected="selected"
    v-model:input-value="inputValue"
    :menu-items="menuItems"
    :menu-config="{ visibleItemLimit: 8 }"
    :placeholder="
      loading ? 'Loading properties…' : 'Property: label, alias, P123 or URL'
    "
    @input="onInput"
    @update:selected="onSelected"
  >
    <template #no-results>No matching property.</template>
  </cdx-lookup>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";
import { CdxLookup, type MenuItemData } from "@wikimedia/codex";
import {
  propertyLabel,
  searchProperties,
  useProperties,
  type Property,
} from "../properties";

const props = defineProps<{ language: string; autofocus?: boolean }>();
const emit = defineEmits<{ select: [property: Property] }>();

const { byId, loading } = useProperties();
const selected = ref<string | null>(null);
const inputValue = ref("");
const menuItems = ref<MenuItemData[]>([]);
const lookup = useTemplateRef<{ $el: HTMLElement }>("lookup");

function onInput(value: string) {
  menuItems.value = searchProperties(value).map((p) => ({
    value: p.id,
    label: propertyLabel(p, props.language) ?? p.id,
    match: `${p.id} · ${p.datatype}`,
    description: p.descriptions[props.language] ?? p.descriptions.en,
  }));
}

function onSelected(id: string | null) {
  const property = id ? byId.value[id] : undefined;
  if (property) emit("select", property);
}

function reset() {
  selected.value = null;
  inputValue.value = "";
  menuItems.value = [];
  focus();
}

function focus() {
  lookup.value?.$el.querySelector("input")?.focus();
}

onMounted(() => props.autofocus && focus());
defineExpose({ focus, reset });
</script>
