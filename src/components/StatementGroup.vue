<template>
  <div class="dd-statement-group">
    <div class="dd-property">
      <span class="dd-property-label">
        <a :href="`#${property}`" :title="property">
          {{ labels[property] ?? property }}
        </a>
        <EntityId :id="property" />
      </span>
      <span class="dd-property-buttons">
        <cdx-button
          v-if="propertyInfo && !adding"
          class="dd-add-value-button"
          weight="quiet"
          action="progressive"
          size="small"
          :aria-label="t('add-value')"
          v-tooltip="t('add-value')"
          @click="adding = true"
        >
          <cdx-icon :icon="cdxIconAdd" size="small" />
        </cdx-button>
        <cdx-button
          class="dd-add-value-button"
          weight="quiet"
          size="small"
          :aria-label="t('copy-statements', claims.length)"
          v-tooltip="t('copy-statements', claims.length)"
          @click="
            emit(
              'copy',
              claims.filter((c) => !removed.has(c.id)),
            )
          "
        >
          <cdx-icon :icon="cdxIconCopy" size="small" />
        </cdx-button>
      </span>
      <div v-if="hidden > 0 || expanded" class="dd-property-actions">
        <cdx-button
          v-if="hidden > 0"
          weight="quiet"
          size="small"
          @click="expanded = true"
        >
          <cdx-icon :icon="cdxIconExpand" size="small" />
          {{ t("more", hidden) }}
        </cdx-button>
        <cdx-button
          v-else-if="expanded"
          weight="quiet"
          size="small"
          @click="expanded = false"
        >
          <cdx-icon :icon="cdxIconCollapse" size="small" />
          {{ t("show-less") }}
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
            'dd-value-wide':
              addingQualifier === claim.id ||
              editingQualifier?.claimId === claim.id,
            'dd-pending': pending.has(claim.id),
            'dd-changed': changed.has(claim.id),
            'dd-removed': removed.has(claim.id),
          },
        ]"
      >
        <div class="dd-mainsnak">
          <cdx-icon
            v-if="claim.rank === 'preferred'"
            :icon="cdxIconUpTriangle"
            size="x-small"
            :title="t('rank-preferred')"
          />
          <cdx-icon
            v-else-if="claim.rank === 'deprecated'"
            :icon="cdxIconDownTriangle"
            size="x-small"
            :title="t('rank-deprecated')"
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
          <div v-if="editing === claim.id" class="dd-edit">
            <ValueInput
              :property="property"
              :datatype="
                claim.mainsnak.datatype ?? propertyInfo?.datatype ?? 'string'
              "
              :language="language"
              :original="claim.mainsnak"
              :label="labels[property] ?? property"
              @submit="
                (snak, label) => {
                  emit('change', claim, snak, label);
                  editing = undefined;
                }
              "
              @keydown.esc="editing = undefined"
            />
            <cdx-button
              weight="quiet"
              :aria-label="t('cancel')"
              @click="editing = undefined"
            >
              <cdx-icon :icon="cdxIconClose" />
            </cdx-button>
          </div>
          <SnakValue
            v-else
            class="dd-snak"
            :snak="claim.mainsnak"
            :labels="labels"
            :formatter-urls="formatterUrls"
            @dblclick="startEdit(claim)"
          />
          <details v-if="claim.references?.length" class="dd-references">
            <summary :title="t('references', claim.references.length)">
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
          <span v-if="editing !== claim.id" class="dd-actions">
            <cdx-button
              v-if="!removed.has(claim.id)"
              class="dd-hover"
              weight="quiet"
              size="small"
              :aria-label="t('edit')"
              v-tooltip="t('edit')"
              @click="startEdit(claim)"
            >
              <cdx-icon :icon="cdxIconEdit" size="small" />
            </cdx-button>
            <cdx-button
              v-if="!removed.has(claim.id)"
              class="dd-hover"
              weight="quiet"
              size="small"
              :aria-label="t('add-qualifier')"
              v-tooltip="t('add-qualifier')"
              @click="addingQualifier = claim.id"
            >
              <cdx-icon :icon="cdxIconAdd" size="small" />
            </cdx-button>
            <cdx-button
              class="dd-hover"
              weight="quiet"
              size="small"
              :aria-label="t('copy-statement')"
              v-tooltip="t('copy-statement')"
              @click="emit('copy', [claim])"
            >
              <cdx-icon :icon="cdxIconCopy" size="small" />
            </cdx-button>
            <cdx-button
              v-if="
                pending.has(claim.id) ||
                changed.has(claim.id) ||
                removed.has(claim.id)
              "
              weight="quiet"
              size="small"
              :aria-label="t('undo')"
              v-tooltip="t('undo')"
              @click="emit('undo', claim)"
            >
              <cdx-icon :icon="cdxIconUndo" size="small" />
            </cdx-button>
            <cdx-button
              v-else
              class="dd-hover"
              weight="quiet"
              action="destructive"
              size="small"
              :aria-label="t('remove')"
              v-tooltip="t('remove')"
              @click="emit('remove', claim)"
            >
              <cdx-icon :icon="cdxIconTrash" size="small" />
            </cdx-button>
          </span>
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
              <span
                v-if="
                  editingQualifier?.claimId === claim.id &&
                  editingQualifier.property === qualifier &&
                  editingQualifier.index === i
                "
                class="dd-edit"
              >
                <ValueInput
                  :property="String(qualifier)"
                  :datatype="
                    snak.datatype ?? byId[qualifier]?.datatype ?? 'string'
                  "
                  :language="language"
                  :original="snak"
                  :label="labels[qualifier] ?? String(qualifier)"
                  @submit="
                    (value, label) => {
                      setQualifier(claim, String(qualifier), i, value, label);
                      editingQualifier = undefined;
                    }
                  "
                  @keydown.esc="editingQualifier = undefined"
                />
                <cdx-button
                  weight="quiet"
                  size="small"
                  :aria-label="t('cancel')"
                  @click="editingQualifier = undefined"
                >
                  <cdx-icon :icon="cdxIconClose" size="small" />
                </cdx-button>
              </span>
              <span v-else class="dd-qualifier-value">
                <SnakValue
                  :snak="snak"
                  :labels="labels"
                  :formatter-urls="formatterUrls"
                  @dblclick="startEditQualifier(claim, String(qualifier), i)"
                />
                <cdx-button
                  v-if="!removed.has(claim.id) && snak.snaktype === 'value'"
                  class="dd-hover dd-qualifier-action"
                  weight="quiet"
                  size="small"
                  :aria-label="t('edit-qualifier')"
                  v-tooltip="t('edit-qualifier')"
                  @click="startEditQualifier(claim, String(qualifier), i)"
                >
                  <cdx-icon :icon="cdxIconEdit" size="small" />
                </cdx-button>
                <cdx-button
                  v-if="!removed.has(claim.id)"
                  class="dd-hover dd-qualifier-action"
                  weight="quiet"
                  action="destructive"
                  size="small"
                  :aria-label="t('remove-qualifier')"
                  v-tooltip="t('remove-qualifier')"
                  @click="setQualifier(claim, String(qualifier), i)"
                >
                  <cdx-icon :icon="cdxIconTrash" size="small" />
                </cdx-button>
              </span>
            </template>
          </span>
        </div>
        <AddStatement
          v-if="addingQualifier === claim.id"
          class="dd-add-qualifier"
          :language="language"
          @add="
            (snak, label) =>
              setQualifier(
                claim,
                snak.property,
                claim.qualifiers?.[snak.property]?.length ?? 0,
                snak,
                label,
              )
          "
          @close="addingQualifier = undefined"
        />
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
import { t } from "../i18n";
import { computed, ref } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconClose,
  cdxIconCollapse,
  cdxIconCopy,
  cdxIconDownTriangle,
  cdxIconEdit,
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
import ValueInput from "./ValueInput.vue";

const props = defineProps<{
  property: string;
  claims: Claim[];
  labels: Record<string, string>;
  formatterUrls: Record<string, string>;
  language: string;
  pending: Set<string>;
  changed: Set<string>;
  removed: Set<string>;
}>();
const emit = defineEmits<{
  add: [snak: Snak, label?: string];
  remove: [claim: Claim];
  undo: [claim: Claim];
  copy: [claims: Claim[]];
  change: [claim: Claim, snak: Snak, label?: string];
  qualifiers: [
    claim: Claim,
    qualifiers: Record<string, Snak[]>,
    snak?: Snak,
    label?: string,
  ];
}>();

const { byId } = useProperties();
const adding = ref(false);
const editing = ref<string>();

function startEdit(claim: Claim) {
  if (props.removed.has(claim.id) || claim.mainsnak.snaktype !== "value")
    return;
  editing.value = claim.id;
}

const addingQualifier = ref<string>();
const editingQualifier = ref<{
  claimId: string;
  property: string;
  index: number;
}>();

function startEditQualifier(claim: Claim, property: string, index: number) {
  const snak = claim.qualifiers?.[property]?.[index];
  if (props.removed.has(claim.id) || snak?.snaktype !== "value") return;
  editingQualifier.value = { claimId: claim.id, property, index };
}

/** Replace (or add at the end) the qualifier at `index`; without `snak`, remove it. */
function setQualifier(
  claim: Claim,
  property: string,
  index: number,
  snak?: Snak,
  label?: string,
) {
  const qualifiers = { ...claim.qualifiers };
  const snaks = [...(qualifiers[property] ?? [])];
  if (snak) snaks.splice(index, 1, snak);
  else snaks.splice(index, 1);
  if (snaks.length) qualifiers[property] = snaks;
  else delete qualifiers[property];
  emit("qualifiers", claim, qualifiers, snak, label);
}

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

const RANK_ORDER: Record<Claim["rank"], number> = {
  preferred: 0,
  normal: 1,
  deprecated: 2,
};

/** Point in time (P585) or publication date (P577) qualifier as [year, "-MM-DDThh:mm:ssZ"]. */
function pointInTime(claim: Claim): [number, string] | undefined {
  const snak = claim.qualifiers?.P585?.[0] ?? claim.qualifiers?.P577?.[0];
  const value = snak?.datavalue?.value as { time?: string } | undefined;
  const match = value?.time?.match(/^([+-]\d+)(.*)$/);
  return match ? [Number(match[1]), match[2]] : undefined;
}

/** Preferred first, deprecated last; within a rank, newest P585/P577 first. */
const sortedClaims = computed(() =>
  [...props.claims].sort((a, b) => {
    const byRank = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (byRank) return byRank;
    const ta = pointInTime(a);
    const tb = pointInTime(b);
    if (!ta || !tb) return ta ? -1 : tb ? 1 : 0;
    return tb[0] - ta[0] || tb[1].localeCompare(ta[1]);
  }),
);
const visibleClaims = computed(() =>
  expanded.value || sortedClaims.value.length <= COLLAPSE_ABOVE
    ? sortedClaims.value
    : sortedClaims.value.slice(0, COLLAPSED),
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
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  align-content: flex-start;
  gap: 0 0.25rem;
  background: var(--background-color-neutral-subtle);
  padding: 0.375rem 0.625rem;
  font-weight: 600;
  line-height: 1.3;
}
.dd-property-label {
  flex: 1;
}
/* both buttons together at the end of the first line */
.dd-property-buttons {
  display: flex;
}
.dd-add-value-button {
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0;
  vertical-align: middle;
}
@media (hover: hover) {
  .dd-add-value-button {
    opacity: 0.5;
  }
}
.dd-statement-group:hover .dd-add-value-button,
.dd-property-buttons:focus-within .dd-add-value-button {
  opacity: 1;
}
.dd-property-actions {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  margin-inline-start: -0.5rem;
  font-weight: normal;
}
.dd-property-actions .cdx-button {
  min-height: 1.75rem;
}
/* values flow in columns, single values span the full width */
.dd-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}
.dd-value {
  position: relative;
  padding-block: 0.375rem;
  padding-inline: 0.625rem;
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
.dd-qualifier-value {
  display: inline-flex;
  align-items: baseline;
}
/* Codex minimum target size for small buttons (24px) */
.dd-qualifier-action {
  align-self: center;
}
.dd-qualifiers .dd-edit {
  flex-basis: 100%;
  font-size: var(--font-size-medium);
}
.dd-value-wide {
  grid-column: 1 / -1;
}
.dd-add-qualifier {
  margin: 0.375rem 0 0;
}
.dd-qualifier-property {
  color: var(--color-subtle);
  margin-inline-end: 0.25rem;
}
.dd-qualifier-property::after {
  content: ":";
}
.dd-references {
  font-size: 0.8125em;
}
/* opened references go below, the actions stay next to the value */
.dd-references[open] {
  flex-basis: 100%;
  order: 1;
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
  border-inline-start: 2px solid var(--border-color-subtle);
  padding-inline-start: 0.5rem;
  margin: 0.25rem 0;
}
.dd-pending {
  background: var(--background-color-success-subtle);
}
.dd-removed {
  background: var(--background-color-error-subtle);
}
.dd-changed {
  background: var(--background-color-warning-subtle);
}
.dd-edit {
  display: flex;
  flex: 1;
  gap: 0.25rem;
}
.dd-edit > :first-child {
  flex: 1;
}
.dd-removed .dd-mainsnak {
  text-decoration: line-through;
}
/* right after the value, where the pointer usually is */
.dd-actions {
  display: inline-flex;
  align-self: center;
  margin-inline-start: 1rem;
}
.dd-actions .cdx-button {
  min-height: 1.5rem;
  min-width: 1.5rem;
}
/* reveal on hover; always visible on touch devices */
@media (hover: hover) {
  .dd-hover {
    opacity: 0;
  }
}
/* fade in and out, keeping Codex's button transitions */
.dd-hover,
.dd-add-value-button {
  transition-property:
    var(--transition-property-fade), var(--transition-property-base);
  transition-duration: var(--transition-duration-medium);
  transition-timing-function: var(--transition-timing-function-system);
}
@media (prefers-reduced-motion: reduce) {
  .dd-hover,
  .dd-add-value-button {
    transition: none;
  }
}
/* keyboard focus on one action reveals all of them */
.dd-value:hover .dd-hover,
.dd-value:focus-within .dd-hover {
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
