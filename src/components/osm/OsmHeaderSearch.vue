<template>
  <!-- prevent the native form submission; navigation happens via the hash -->
  <div @submit.prevent>
    <cdx-typeahead-search
      id="dd-osm-search"
      form-action=""
      :search-results="results"
      :search-footer-url="footerUrl"
      :placeholder="t('osm-search-placeholder')"
      :highlight-query="true"
      :auto-expand-width="false"
      :show-thumbnail="false"
      @input="onInput"
      @search-result-click="onClick"
      @submit="onSubmit"
    >
      <template #search-footer-text="{ searchQuery }">
        {{ t("osm-search-nominatim", searchQuery) }}
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
import { t } from "../../i18n";
import { suggestPlaces } from "../../osm/geocoding";
import { osmHash, parseOsmRef, shortRef } from "../../osm/osm-ref";
import { placeType } from "../../osm/presets";

/**
 * OSM object search: IDs and URLs are recognised directly, places are
 * suggested by Photon while typing; Enter searches with Nominatim.
 */
const props = defineProps<{ language: string }>();
const emit = defineEmits<{ select: [hash: string] }>();

const query = ref("");
const results = ref<SearchResult[]>([]);
const footerUrl = computed(() => searchHash(query.value));
let controller: AbortController | undefined;

function searchHash(q: string) {
  return `#osm/search/${encodeURIComponent(q.trim())}`;
}

const suggest = useDebounceFn(async (value: string) => {
  controller?.abort();
  controller = new AbortController();
  const places = await suggestPlaces(
    value,
    props.language,
    controller.signal,
  ).catch(() => []);
  // ignore responses for outdated input
  if (value !== query.value) return;
  results.value = places.map((p) => ({
    value: osmHash(p),
    label: p.name,
    match: shortRef(p),
    description: [placeType(p), p.description].filter(Boolean).join(" · "),
    url: osmHash(p),
  }));
}, 300);

function onInput(value: string) {
  query.value = value;
  const osmRef = parseOsmRef(value);
  if (osmRef) {
    results.value = [
      {
        value: osmHash(osmRef),
        label: `${osmRef.type} ${osmRef.id}`,
        match: shortRef(osmRef),
        url: osmHash(osmRef),
      },
    ];
    return;
  }
  if (value.trim().length < 3) results.value = [];
  else suggest(value);
}

function onClick(event: SearchResultClickEvent) {
  if (event.searchResult) emit("select", String(event.searchResult.value));
}

function onSubmit(event: SearchResultClickEvent) {
  const osmRef = parseOsmRef(query.value);
  const hash =
    event.searchResult?.value ??
    (osmRef ? osmHash(osmRef) : query.value.trim() && searchHash(query.value));
  if (hash) emit("select", String(hash));
}
</script>
