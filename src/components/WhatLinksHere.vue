<template>
  <div class="dd-backlinks">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <p v-else-if="!loading && !pages.length">{{ t("backlinks-none") }}</p>
    <cdx-search-input
      v-if="pages.length"
      v-model="query"
      class="dd-backlinks-filter"
      :placeholder="t('backlinks-filter')"
      :aria-label="t('backlinks-filter')"
    />
    <p v-if="query && !entities.length && !others.length">
      {{ t("backlinks-filter-none") }}
    </p>
    <template v-if="entities.length">
      <h3>{{ t("backlinks-entities", entities.length) }}</h3>
      <ul>
        <li v-for="page in entities" :key="page.title">
          <a :href="`#${page.id}`">{{ page.label ?? page.id }}</a>
          <EntityId :id="page.id!" />
          <span v-if="page.description" class="dd-backlink-description">
            {{ page.description }}
          </span>
        </li>
      </ul>
    </template>
    <template v-if="others.length">
      <h3>{{ t("backlinks-pages", others.length) }}</h3>
      <ul>
        <li v-for="page in others" :key="page.title">
          <a
            :href="`https://www.wikidata.org/wiki/${encodeURIComponent(page.title)}`"
            target="_blank"
            rel="external noopener"
          >
            {{ page.title }}
          </a>
        </li>
      </ul>
    </template>
    <p class="dd-backlinks-actions">
      <cdx-progress-indicator v-if="loading" show-label>
        {{ t("backlinks-loading") }}
      </cdx-progress-indicator>
      <cdx-button v-else-if="next" @click="load">
        {{ t("backlinks-more") }}
      </cdx-button>
      <a
        :href="`https://www.wikidata.org/wiki/Special:WhatLinksHere/${id}`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("backlinks-wikidata") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { locale, t } from "../i18n";
import { computed, ref } from "vue";
import {
  CdxButton,
  CdxMessage,
  CdxProgressIndicator,
  CdxSearchInput,
} from "@wikimedia/codex";
import { useSorted } from "@vueuse/core";
import { getBacklinks, type Backlink } from "../wikidata";
import EntityId from "./EntityId.vue";

const props = defineProps<{ id: string; language: string }>();

const pages = ref<Backlink[]>([]);
const next = ref<Record<string, string>>();
const loading = ref(false);
const error = ref<string>();
const query = ref("");

/** case-insensitive substring match of the filter query against any of the texts */
function matches(...texts: (string | undefined)[]): boolean {
  const q = query.value.trim().toLocaleLowerCase();
  return !q || texts.some((s) => s?.toLocaleLowerCase().includes(q));
}

// the language is fixed, the component is recreated on changes
const collator = new Intl.Collator(locale(props.language), { numeric: true });
/** items, properties and lexemes, linking via statements; by label, unlabeled last by ID */
const entities = useSorted(
  computed(() =>
    pages.value.filter((p) => p.id && matches(p.id, p.label, p.description)),
  ),
  (a, b) =>
    a.label && b.label
      ? collator.compare(a.label, b.label)
      : a.label
        ? -1
        : b.label
          ? 1
          : collator.compare(a.id!, b.id!),
);
/** project, user and talk pages */
const others = computed(() =>
  pages.value.filter((p) => !p.id && matches(p.title)),
);

async function load() {
  loading.value = true;
  try {
    const result = await getBacklinks(props.id, props.language, next.value);
    pages.value.push(...result.pages);
    next.value = result.next;
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}
load();
</script>

<style scoped>
.dd-backlinks-filter {
  margin-top: 1rem;
}
.dd-backlinks h3 {
  margin: 1rem 0 0.5rem;
}
.dd-backlinks ul {
  margin: 0;
  padding-inline-start: 1.25rem;
}
.dd-backlinks li + li {
  margin-top: 0.25rem;
}
.dd-backlink-description {
  color: var(--color-subtle);
  margin-inline-start: 0.25rem;
}
.dd-backlinks-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
