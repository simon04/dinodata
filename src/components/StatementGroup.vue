<template>
  <div class="dd-statement-group">
    <div class="dd-property">
      <a :href="`#${property}`" :title="property">
        {{ labels[property] ?? property }}
      </a>
      <EntityId :id="property" />
      <div>
        <cdx-button
          v-if="byId[property] && !adding"
          class="dd-add-button"
          weight="quiet"
          action="progressive"
          size="small"
          @click="adding = true"
        >
          <cdx-icon :icon="cdxIconAdd" size="small" />
          add value
        </cdx-button>
      </div>
    </div>
    <div class="dd-values">
      <div
        v-for="claim in claims"
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
            size="small"
            title="Preferred rank"
          />
          <cdx-icon
            v-else-if="claim.rank === 'deprecated'"
            :icon="cdxIconDownTriangle"
            size="small"
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
            :snak="claim.mainsnak"
            :labels="labels"
            :formatter-urls="formatterUrls"
          />
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
        <div
          v-for="(snaks, qualifier) in claim.qualifiers"
          :key="qualifier"
          class="dd-qualifier"
        >
          <span class="dd-qualifier-property">
            <a :href="`#${qualifier}`">
              {{ labels[qualifier] ?? qualifier }}
            </a>
            <EntityId :id="qualifier" />
          </span>
          <span>
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
        <details v-if="claim.references?.length" class="dd-references">
          <summary>
            <cdx-icon :icon="cdxIconReference" size="small" />
            {{ claim.references.length }}
            {{ claim.references.length === 1 ? "reference" : "references" }}
          </summary>
          <div
            v-for="(reference, r) in claim.references"
            :key="r"
            class="dd-reference"
          >
            <div
              v-for="(snaks, refProperty) in reference.snaks"
              :key="refProperty"
              class="dd-qualifier"
            >
              <span class="dd-qualifier-property">
                <a :href="`#${refProperty}`">
                  {{ labels[refProperty] ?? refProperty }}
                </a>
                <EntityId :id="refProperty" />
              </span>
              <span>
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
          </div>
        </details>
      </div>
      <AddStatement
        v-if="adding && byId[property]"
        class="dd-add-value"
        :language="language"
        :fixed-property="byId[property]"
        @add="(snak, label) => emit('add', snak, label)"
        @close="adding = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconDownTriangle,
  cdxIconReference,
  cdxIconTrash,
  cdxIconUndo,
  cdxIconUpTriangle,
} from "@wikimedia/codex-icons";
import { useProperties } from "../properties";
import type { Claim, Snak } from "../wikidata";
import AddStatement from "./AddStatement.vue";
import EntityId from "./EntityId.vue";
import SnakValue from "./SnakValue.vue";

defineProps<{
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

function thumb(file: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=160`;
}
</script>

<style scoped>
.dd-statement-group {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) 3fr;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  margin-bottom: 0.75rem;
  overflow: hidden;
}
.dd-property {
  background: var(--background-color-neutral-subtle);
  padding: 0.75rem;
  font-weight: bold;
}
.dd-value {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-value:last-child {
  border-bottom: none;
}
.dd-mainsnak {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.dd-pending {
  background: var(--background-color-success-subtle);
}
.dd-removed {
  background: var(--background-color-error-subtle);
}
.dd-removed .dd-mainsnak > :not(.dd-action) {
  text-decoration: line-through;
}
.dd-action {
  margin-left: auto;
}
.dd-hover {
  opacity: 0;
}
.dd-value:hover .dd-hover,
.dd-hover:focus {
  opacity: 1;
}
.dd-add-button {
  margin: 0.25rem 0 0 -0.5rem;
  font-weight: normal;
}
.dd-add-value {
  margin: 0.5rem;
}
.dd-rank-deprecated .dd-mainsnak {
  text-decoration: line-through;
  opacity: 0.6;
}
.dd-media {
  max-width: 160px;
  max-height: 120px;
  border-radius: var(--border-radius-base);
}
.dd-qualifier {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 2fr;
  gap: 0.5rem;
  font-size: 0.875em;
  margin: 0.25rem 0 0 1rem;
}
.dd-qualifier-property a {
  color: var(--color-subtle);
}
.dd-references {
  margin: 0.5rem 0 0 1rem;
  font-size: 0.875em;
}
.dd-references summary {
  cursor: pointer;
  color: var(--color-progressive);
}
.dd-reference {
  border-left: 3px solid var(--border-color-subtle);
  padding: 0.25rem 0;
  margin: 0.5rem 0;
}
.dd-reference .dd-qualifier {
  margin-left: 0.5rem;
}
@media (max-width: 640px) {
  .dd-statement-group,
  .dd-qualifier {
    grid-template-columns: 1fr;
  }
}
</style>
