<template>
  <section class="dd-lookup">
    <h1>
      <code class="dd-id-chip">{{ property }}</code>
      =
      <code>{{ value }}</code>
    </h1>
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <cdx-progress-indicator v-else-if="loading" show-label>
      {{ t("backlinks-loading") }}
    </cdx-progress-indicator>
    <p v-else-if="!items.length">{{ t("lookup-none", property, value) }}</p>
    <template v-else>
      <p>{{ t("lookup-several", items.length) }}</p>
      <ul>
        <li v-for="item in items" :key="item.id">
          <a :href="`#${item.id}`">{{ item.label ?? item.id }}</a>
          <EntityId :id="item.id" />
          <span v-if="item.description" class="dd-lookup-description">
            {{ item.description }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { t } from "../i18n";
import { findByStatement, type FoundItem } from "../wikidata";
import EntityId from "./EntityId.vue";

/**
 * `#P954=8100002`: the item with this statement value. Exactly one → open it
 * (replacing the lookup in the history, so "back" leads to where the link was
 * followed); several → list them; none → message.
 */
const props = defineProps<{
  property: string;
  value: string;
  language: string;
}>();

const items = ref<FoundItem[]>([]);
const loading = ref(true);
const error = ref<string>();

watch(
  () => [props.property, props.value],
  async () => {
    loading.value = true;
    error.value = undefined;
    try {
      items.value = await findByStatement(
        props.property,
        props.value,
        props.language,
      );
      if (items.value.length === 1) location.replace(`#${items.value[0]!.id}`);
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.dd-lookup h1 {
  font-size: 1.25rem;
}
.dd-lookup ul {
  padding-inline-start: 1.25rem;
}
.dd-lookup li + li {
  margin-top: 0.25rem;
}
.dd-lookup-description {
  color: var(--color-subtle);
  margin-inline-start: 0.5rem;
}
</style>
