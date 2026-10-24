<template>
  <div class="dd-compare">
    <div class="dd-compare-toolbar">
      <EntitySearch
        :language="language"
        :placeholder="t('compare-search')"
        @select="(id) => (other = id)"
      />
      <cdx-button v-if="otherEntity" @click="emit('swap', otherEntity.id)">
        <span aria-hidden="true">⇄</span>
        {{ t("compare-swap") }}
      </cdx-button>
      <cdx-checkbox v-if="otherEntity" v-model="onlyDifferences" :inline="true">
        {{ t("compare-differences") }}
      </cdx-checkbox>
    </div>
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <cdx-progress-indicator v-else-if="loading" show-label>
      {{ t("backlinks-loading") }}
    </cdx-progress-indicator>
    <p v-else-if="!otherEntity" class="dd-compare-hint">
      {{ t("compare-hint") }}
    </p>
    <table v-else class="dd-compare-table">
      <thead>
        <tr>
          <th scope="col">{{ t("compare-property") }}</th>
          <th scope="col">
            {{ label(entity, language) ?? entity.id }}
            <EntityId :id="entity.id" />
          </th>
          <th scope="col">
            <a :href="`#${otherEntity.id}`">
              {{ label(otherEntity, language) ?? otherEntity.id }}
            </a>
            <EntityId :id="otherEntity.id" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in visibleRows"
          :key="row.property"
          :class="`dd-compare-${row.status}`"
        >
          <th scope="row">
            <a
              :href="`#${row.property}`"
              v-tooltip="allDescriptions[row.property]"
            >
              {{ allLabels[row.property] ?? row.property }}
            </a>
            <EntityId :id="row.property" />
          </th>
          <td>
            <ul>
              <li v-for="claim in row.left" :key="claim.id">
                <SnakValue
                  :snak="claim.mainsnak"
                  :labels="allLabels"
                  :descriptions="allDescriptions"
                  :formatter-urls="formatterUrls"
                />
              </li>
            </ul>
          </td>
          <td>
            <ul>
              <li v-for="claim in row.right" :key="claim.id">
                <cdx-button
                  v-if="row.missing.includes(claim)"
                  weight="quiet"
                  size="small"
                  action="progressive"
                  :aria-label="t('compare-copy')"
                  v-tooltip="t('compare-copy')"
                  @click="emit('copy', [claim])"
                >
                  <cdx-icon :icon="cdxIconArrowPrevious" size="small" />
                </cdx-button>
                <SnakValue
                  :snak="claim.mainsnak"
                  :labels="allLabels"
                  :descriptions="allDescriptions"
                  :formatter-urls="formatterUrls"
                />
              </li>
            </ul>
            <cdx-button
              v-if="row.missing.length > 1"
              weight="quiet"
              size="small"
              action="progressive"
              @click="emit('copy', row.missing)"
            >
              <cdx-icon :icon="cdxIconArrowPrevious" size="small" />
              {{ t("compare-copy-all", row.missing.length) }}
            </cdx-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import {
  CdxButton,
  CdxCheckbox,
  CdxIcon,
  CdxMessage,
  CdxProgressIndicator,
} from "@wikimedia/codex";
import { cdxIconArrowPrevious } from "@wikimedia/codex-icons";
import { t } from "../i18n";
import { snakValue } from "../quickstatements";
import {
  getEntities,
  getLabels,
  label,
  referencedIds,
  type Claim,
  type Entity,
  type Snak,
} from "../wikidata";
import EntityId from "./EntityId.vue";
import EntitySearch from "./EntitySearch.vue";
import SnakValue from "./SnakValue.vue";

const props = defineProps<{
  entity: Entity;
  /** the item's properties in display order */
  properties: string[];
  /** the item's statements including unsaved edits */
  claimsOf: (property: string) => Claim[];
  language: string;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  formatterUrls: Record<string, string>;
}>();
const emit = defineEmits<{
  copy: [claims: Claim[]];
  /** show the compared item on the left, this one on the right */
  swap: [other: string];
}>();

/** ID of the item compared with, kept while switching tabs */
const other = defineModel<string>("other");
const otherEntity = shallowRef<Entity>();
const loading = ref(false);
const error = ref<string>();
const onlyDifferences = ref(false);

/** labels and descriptions of the other item's properties and values */
const otherLabels = ref<Record<string, string>>({});
const otherDescriptions = ref<Record<string, string>>({});
const allLabels = computed(() => ({ ...otherLabels.value, ...props.labels }));
const allDescriptions = computed(() => ({
  ...otherDescriptions.value,
  ...props.descriptions,
}));

watch(
  other,
  async (id) => {
    otherEntity.value = undefined;
    error.value = undefined;
    if (!id) return;
    loading.value = true;
    try {
      const e = (await getEntities([id]))[id];
      if (!e || "missing" in e) throw new Error(`${id} not found`);
      if (other.value !== id) return;
      otherEntity.value = e;
      await getLabels(
        [e.id, ...referencedIds(e)].filter((i) => !allLabels.value[i]),
        props.language,
        (l, d) => {
          otherLabels.value = { ...otherLabels.value, ...l };
          otherDescriptions.value = { ...otherDescriptions.value, ...d };
        },
      );
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

// compare values in their normalized QuickStatements form
const key = (snak: Snak) => `${snak.property}|${snakValue(snak)}`;

/** Properties of both items, aligned: this item's order, then the other's. */
const rows = computed(() => {
  const e = otherEntity.value;
  if (!e) return [];
  const properties = [
    ...new Set([...props.properties, ...Object.keys(e.claims)]),
  ];
  return properties.map((property) => {
    const left = props.claimsOf(property);
    const right = e.claims[property] ?? [];
    const leftKeys = new Set(left.map((c) => key(c.mainsnak)));
    const rightKeys = new Set(right.map((c) => key(c.mainsnak)));
    /** values of the other item this one lacks */
    const missing = right.filter((c) => !leftKeys.has(key(c.mainsnak)));
    const status = !right.length
      ? "left"
      : !left.length
        ? "right"
        : !missing.length && [...leftKeys].every((k) => rightKeys.has(k))
          ? "same"
          : "different";
    return { property, left, right, missing, status };
  });
});
const visibleRows = computed(() =>
  onlyDifferences.value
    ? rows.value.filter((r) => r.status !== "same")
    : rows.value,
);
</script>

<style scoped>
.dd-compare-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.dd-compare-hint {
  color: var(--color-subtle);
}
.dd-compare-table {
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: collapse;
  table-layout: fixed;
}
.dd-compare-table th,
.dd-compare-table td {
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-color-subtle);
  text-align: start;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.dd-compare-table thead th {
  position: sticky;
  top: var(--dd-sticky-top, 0);
  z-index: 1;
  background: var(--background-color-base);
}
.dd-compare-table tbody th {
  width: 25%;
  background: var(--background-color-neutral-subtle);
}
.dd-compare-table ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.dd-compare-table li {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}
.dd-compare-table li + li {
  margin-top: 0.25rem;
}
/* only on one side, or with differing values */
.dd-compare-left td:nth-child(2),
.dd-compare-right td:nth-child(3) {
  background: var(--background-color-progressive-subtle);
}
.dd-compare-different td {
  background: var(--background-color-warning-subtle);
}
</style>
