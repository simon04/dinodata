<template>
  <div class="dd-statement-group">
    <div class="dd-property">
      <a :href="`#${property}`" :title="property">
        {{ labels[property] ?? property }}
      </a>
      <EntityId :id="property" />
      <cdx-button
        v-if="propertyInfo && !adding"
        class="dd-add-value-button"
        weight="quiet"
        action="progressive"
        size="small"
        aria-label="Add value"
        title="Add value"
        @click="adding = true"
      >
        <cdx-icon :icon="cdxIconAdd" size="small" />
      </cdx-button>
      <div v-if="hidden > 0 || expanded" class="dd-property-actions">
        <cdx-button
          v-if="hidden > 0"
          weight="quiet"
          size="small"
          @click="expanded = true"
        >
          <cdx-icon :icon="cdxIconExpand" size="small" />
          {{ hidden }} more
        </cdx-button>
        <cdx-button
          v-else-if="expanded"
          weight="quiet"
          size="small"
          @click="expanded = false"
        >
          <cdx-icon :icon="cdxIconCollapse" size="small" />
          show less
        </cdx-button>
      </div>
    </div>
    <div class="dd-values">
      <div
        v-for="claim in visibleClaims"
        :key="claim.id"
        class="dd-value"
        :class="[
          `dd-rank-${claim.rank}`,
          {
            'dd-pending': pending.has(claim.id),
            'dd-removed': removed.has(claim.id),
          },
        ]"
      >
        <div class="dd-mainsnak">
          <cdx-icon
            v-if="claim.rank === 'preferred'"
            :icon="cdxIconUpTriangle"
            size="x-small"
            title="Preferred rank"
          />
          <cdx-icon
            v-else-if="claim.rank === 'deprecated'"
            :icon="cdxIconDownTriangle"
            size="x-small"
            title="Deprecated rank"
          />
          <img
            v-if="
              claim.mainsnak.datatype === 'commonsMedia' &&
              claim.mainsnak.datavalue
            "
            class="dd-media"
            :src="thumb(String(claim.mainsnak.datavalue.value))"
            loading="lazy"
            alt=""
          />
          <SnakValue
            class="dd-snak"
            :snak="claim.mainsnak"
            :labels="labels"
            :formatter-urls="formatterUrls"
          />
          <details v-if="claim.references?.length" class="dd-references">
            <summary
              :title="`${claim.references.length} ${claim.references.length === 1 ? 'reference' : 'references'}`"
            >
              <cdx-icon :icon="cdxIconReference" size="x-small" />
              {{ claim.references.length }}
            </summary>
            <div
              v-for="(reference, r) in claim.references"
              :key="r"
              class="dd-reference"
            >
              <span
                v-for="(snaks, refProperty) in reference.snaks"
                :key="refProperty"
                class="dd-qualifier"
              >
                <a :href="`#${refProperty}`" class="dd-qualifier-property">
                  {{ labels[refProperty] ?? refProperty }}
                </a>
                <template v-for="(snak, i) in snaks" :key="i">
                  <span v-if="i">,</span>
                  <SnakValue
                    :snak="snak"
                    :labels="labels"
                    :formatter-urls="formatterUrls"
                  />
                </template>
              </span>
            </div>
          </details>
        </div>
        <div v-if="claim.qualifiers" class="dd-qualifiers">
          <span
            v-for="(snaks, qualifier) in claim.qualifiers"
            :key="qualifier"
            class="dd-qualifier"
          >
            <a
              :href="`#${qualifier}`"
              class="dd-qualifier-property"
              :title="qualifier"
            >
              {{ labels[qualifier] ?? qualifier }}
            </a>
            <template v-for="(snak, i) in snaks" :key="i">
              <span v-if="i">,</span>
              <SnakValue
                :snak="snak"
                :labels="labels"
                :formatter-urls="formatterUrls"
              />
            </template>
          </span>
        </div>
        <cdx-button
          v-if="pending.has(claim.id) || removed.has(claim.id)"
          class="dd-action"
          weight="quiet"
          size="small"
          aria-label="Undo"
          title="Undo"
          @click="emit('undo', claim)"
        >
          <cdx-icon :icon="cdxIconUndo" size="small" />
        </cdx-button>
        <cdx-button
          v-else
          class="dd-action dd-hover"
          weight="quiet"
          action="destructive"
          size="small"
          aria-label="Remove"
          title="Remove"
          @click="emit('remove', claim)"
        >
          <cdx-icon :icon="cdxIconTrash" size="small" />
        </cdx-button>
      </div>
      <AddStatement
        v-if="adding && propertyInfo"
        class="dd-add-value"
        :language="language"
        :fixed-property="propertyInfo"
        @add="(snak, label) => emit('add', snak, label)"
        @close="adding = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconCollapse,
  cdxIconDownTriangle,
  cdxIconExpand,
  cdxIconReference,
  cdxIconTrash,
  cdxIconUndo,
  cdxIconUpTriangle,
} from "@wikimedia/codex-icons";
import { useProperties, type Property } from "../properties";
import type { Claim, Snak } from "../wikidata";
import AddStatement from "./AddStatement.vue";
import EntityId from "./EntityId.vue";
import SnakValue from "./SnakValue.vue";

const props = defineProps<{
  property: string;
  claims: Claim[];
  labels: Record<string, string>;
  formatterUrls: Record<string, string>;
  language: string;
  pending: Set<string>;
  removed: Set<string>;
}>();
const emit = defineEmits<{
  add: [snak: Snak, label?: string];
  remove: [claim: Claim];
  undo: [claim: Claim];
}>();

const { byId } = useProperties();
const adding = ref(false);

/** From the cache, or derived from existing statements while it loads. */
const propertyInfo = computed<Property | undefined>(() => {
  const datatype = props.claims[0]?.mainsnak.datatype;
  return (
    byId.value[props.property] ??
    (datatype
      ? {
          id: props.property,
          datatype,
          labels: {},
          descriptions: {},
          aliases: {},
        }
      : undefined)
  );
});

/** Long lists (e.g. population over time) are collapsed. */
const COLLAPSE_ABOVE = 12;
const COLLAPSED = 8;
const expanded = ref(false);
const visibleClaims = computed(() =>
  expanded.value || props.claims.length <= COLLAPSE_ABOVE
    ? props.claims
    : props.claims.slice(0, COLLAPSED),
);
const hidden = computed(() => props.claims.length - visibleClaims.value.length);

function thumb(file: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=160`;
}
</script>

<style scoped>
.dd-statement-group {
  display: grid;
  grid-template-columns: 15rem 1fr;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-property {
  background: var(--background-color-neutral-subtle);
  padding: 0.375rem 0.625rem;
  font-weight: 600;
  line-height: 1.3;
}
.dd-add-value-button {
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0;
  vertical-align: middle;
  opacity: 0.5;
}
.dd-statement-group:hover .dd-add-value-button,
.dd-add-value-button:focus {
  opacity: 1;
}
.dd-property-actions {
  display: flex;
  flex-wrap: wrap;
  margin-left: -0.5rem;
  font-weight: normal;
}
.dd-property-actions .cdx-button {
  min-height: 1.75rem;
}
/* values flow in columns, single values span the full width */
.dd-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  overflow: hidden;
}
.dd-value {
  position: relative;
  padding: 0.375rem 2rem 0.375rem 0.625rem;
  box-shadow:
    1px 0 0 var(--border-color-subtle),
    0 1px 0 var(--border-color-subtle);
  line-height: 1.4;
}
.dd-mainsnak {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex-wrap: wrap;
}
.dd-snak {
  overflow-wrap: anywhere;
}
.dd-qualifiers {
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.75rem;
  font-size: 0.8125em;
  color: var(--color-subtle);
}
.dd-qualifier-property {
  color: var(--color-subtle);
  margin-right: 0.25rem;
}
.dd-qualifier-property::after {
  content: ":";
}
.dd-references {
  font-size: 0.8125em;
}
.dd-references[open] {
  flex-basis: 100%;
}
.dd-references summary {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  cursor: pointer;
  list-style: none;
  color: var(--color-progressive);
  padding: 0 0.25rem;
  border-radius: var(--border-radius-base);
  background: var(--background-color-progressive-subtle);
}
.dd-references summary::-webkit-details-marker {
  display: none;
}
.dd-reference {
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.75rem;
  border-left: 2px solid var(--border-color-subtle);
  padding-left: 0.5rem;
  margin: 0.25rem 0;
}
.dd-pending {
  background: var(--background-color-success-subtle);
}
.dd-removed {
  background: var(--background-color-error-subtle);
}
.dd-removed .dd-mainsnak {
  text-decoration: line-through;
}
.dd-action {
  position: absolute;
  top: 0.125rem;
  right: 0.125rem;
}
.dd-hover {
  opacity: 0;
}
.dd-value:hover .dd-hover,
.dd-hover:focus {
  opacity: 1;
}
.dd-add-value {
  grid-column: 1 / -1;
  margin: 0.375rem;
}
.dd-rank-deprecated .dd-mainsnak {
  text-decoration: line-through;
  opacity: 0.6;
}
.dd-media {
  max-width: 120px;
  max-height: 80px;
  border-radius: var(--border-radius-base);
  align-self: center;
}
@media (max-width: 640px) {
  .dd-statement-group {
    grid-template-columns: 1fr;
  }
}
</style>
