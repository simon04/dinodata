<template>
  <!-- prevent the native form submission; navigation happens via the hash -->
  <div @submit.prevent>
    <cdx-typeahead-search
      id="dd-search"
      form-action=""
      :search-results="results"
      :search-footer-url="footerUrl"
      :placeholder="t('app-search-placeholder')"
      :highlight-query="true"
      :auto-expand-width="false"
      :show-thumbnail="false"
      @input="onInput"
      @search-result-click="onClick"
      @submit="onSubmit"
    >
      <template #search-footer-text="{ searchQuery }">
        {{ t("search-wikidata", searchQuery) }}
      </template>
    </cdx-typeahead-search>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CdxTypeaheadSearch,
  type SearchResult,
  type SearchResultClickEvent,
} from "@wikimedia/codex";
import { useDebounceFn } from "@vueuse/core";
import { t } from "../i18n";
import { searchEntities } from "../wikidata";

const props = defineProps<{ language: string }>();
const emit = defineEmits<{ select: [id: string] }>();

const query = ref("");
const results = ref<SearchResult[]>([]);
const footerUrl = computed(
  () =>
    `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(query.value)}&title=Special:Search`,
);

const search = useDebounceFn(async (value: string) => {
  const found = await searchEntities(value, props.language);
  // ignore responses for outdated input
  if (value !== query.value) return;
  results.value = found.map((r) => ({
    value: r.id,
    label: r.label ?? r.id,
    match: r.id,
    description: r.description,
    url: `#${r.id}`,
  }));
}, 200);

function onInput(value: string) {
  query.value = value;
  if (!value) results.value = [];
  else search(value);
}

function onClick(event: SearchResultClickEvent) {
  if (event.searchResult) emit("select", String(event.searchResult.value));
}

function onSubmit(event: SearchResultClickEvent) {
  // Enter without choosing a result: take the first one, or an ID like Q42
  const id =
    event.searchResult?.value ??
    query.value
      .trim()
      .toUpperCase()
      .match(/^[LPQ]\d+$/)?.[0] ??
    results.value[0]?.value;
  if (id) emit("select", String(id));
}
</script>
