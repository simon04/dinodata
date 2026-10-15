<template>
  <cdx-lookup
    :aria-label="placeholder ?? t('app-search-placeholder')"
    v-model:selected="selected"
    v-model:input-value="inputValue"
    :menu-items="menuItems"
    :start-icon="cdxIconSearch"
    :placeholder="placeholder ?? t('app-search-placeholder')"
    @input="onInput"
    @update:selected="onSelected"
  >
    <template #no-results>{{ t("search-no-results") }}</template>
  </cdx-lookup>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { ref } from "vue";
import { CdxLookup, type MenuItemData } from "@wikimedia/codex";
import { cdxIconSearch } from "@wikimedia/codex-icons";
import { useDebounceFn } from "@vueuse/core";
import { searchEntities } from "../wikidata";

const props = defineProps<{
  language: string;
  placeholder?: string;
  type?: "item" | "property";
}>();
const emit = defineEmits<{ select: [id: string, label: string] }>();

const selected = ref<string | null>(null);
const inputValue = ref("");
const menuItems = ref<MenuItemData[]>([]);

const onInput = useDebounceFn(async (value: string) => {
  if (!value) {
    menuItems.value = [];
    return;
  }
  const results = await searchEntities(value, props.language, props.type);
  if (value !== inputValue.value) return;
  menuItems.value = results.map((r) => ({
    value: r.id,
    label: r.label ?? r.id,
    description: r.description,
    match: r.id,
  }));
}, 200);

function onSelected(id: string | null) {
  if (!id) return;
  const item = menuItems.value.find((i) => i.value === id);
  emit("select", id, item?.label ?? id);
  inputValue.value = "";
  selected.value = null;
  menuItems.value = [];
}
</script>
