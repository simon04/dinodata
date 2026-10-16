<template>
  <div class="dd-backlinks">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <p v-else-if="!loading && !pages.length">{{ t("backlinks-none") }}</p>
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
import { t } from "../i18n";
import { computed, ref } from "vue";
import { CdxButton, CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { getBacklinks, type Backlink } from "../wikidata";
import EntityId from "./EntityId.vue";

const props = defineProps<{ id: string; language: string }>();

const pages = ref<Backlink[]>([]);
const next = ref<Record<string, string>>();
const loading = ref(false);
const error = ref<string>();

/** items, properties and lexemes, linking via statements */
const entities = computed(() => pages.value.filter((p) => p.id));
/** project, user and talk pages */
const others = computed(() => pages.value.filter((p) => !p.id));

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
