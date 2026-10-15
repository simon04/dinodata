<template>
  <cdx-progress-bar v-if="loading" aria-label="Loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article v-else-if="entity" class="dd-entity">
    <header>
      <h1>
        {{ label(entity, language) ?? entity.id }}
        <span class="dd-id">({{ entity.id }})</span>
      </h1>
      <p class="dd-description">
        {{ entity.descriptions[language]?.value ?? "No description" }}
      </p>
      <p v-if="aliases.length" class="dd-aliases">
        <cdx-info-chip v-for="alias in aliases" :key="alias">
          {{ alias }}
        </cdx-info-chip>
      </p>
    </header>

    <section>
      <h2>Statements</h2>
      <div
        v-for="(claims, property) in entity.claims"
        :key="property"
        class="dd-statement-group"
      >
        <div class="dd-property">
          <a :href="`#${property}`">{{ labels[property] ?? property }}</a>
        </div>
        <div class="dd-values">
          <div
            v-for="claim in claims"
            :key="claim.id"
            class="dd-value"
            :class="`dd-rank-${claim.rank}`"
          >
            <SnakValue :snak="claim.mainsnak" :labels="labels" />
            <div
              v-for="(snaks, qualifier) in claim.qualifiers"
              :key="qualifier"
              class="dd-qualifier"
            >
              {{ labels[qualifier] ?? qualifier }}:
              <template v-for="(snak, i) in snaks" :key="i">
                <span v-if="i">,</span>
                <SnakValue :snak="snak" :labels="labels" />
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { CdxInfoChip, CdxMessage, CdxProgressBar } from "@wikimedia/codex";
import { getEntities, label, type Entity, type Snak } from "../wikidata";
import SnakValue from "./SnakValue.vue";

const props = defineProps<{ id: string; language: string }>();

const entity = ref<Entity>();
const labels = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref<string>();

const aliases = computed(
  () => entity.value?.aliases[props.language]?.map((a) => a.value) ?? [],
);

function referencedIds(e: Entity): string[] {
  const ids = new Set<string>();
  const visit = (snak: Snak) => {
    ids.add(snak.property);
    const v = snak.datavalue?.value as { id?: string; unit?: string };
    if (v?.id) ids.add(v.id);
    const unit = v?.unit?.match(/Q\d+$/)?.[0];
    if (unit) ids.add(unit);
  };
  for (const claims of Object.values(e.claims)) {
    for (const claim of claims) {
      visit(claim.mainsnak);
      Object.values(claim.qualifiers ?? {})
        .flat()
        .forEach(visit);
    }
  }
  return [...ids];
}

watch(
  () => [props.id, props.language],
  async () => {
    loading.value = true;
    error.value = undefined;
    try {
      const entities = await getEntities([props.id]);
      const e = entities[props.id];
      if (!e || "missing" in e) throw new Error(`${props.id} not found`);
      entity.value = e;
      const referenced = await getEntities(referencedIds(e), "labels");
      labels.value = Object.fromEntries(
        Object.entries(referenced).map(([id, r]) => [
          id,
          label(r, props.language) ?? id,
        ]),
      );
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
.dd-id {
  color: var(--color-subtle);
  font-weight: normal;
}
.dd-description {
  font-size: 1.2em;
  margin-top: 0;
}
.dd-aliases {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.dd-statement-group {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) 3fr;
  border: 1px solid var(--border-color-subtle);
  border-radius: 2px;
  margin-bottom: 0.5rem;
}
.dd-property {
  background: var(--background-color-neutral-subtle);
  padding: 0.5rem;
  font-weight: bold;
}
.dd-value {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-value:last-child {
  border-bottom: none;
}
.dd-rank-deprecated {
  text-decoration: line-through;
  opacity: 0.6;
}
.dd-rank-preferred {
  font-weight: bold;
}
.dd-qualifier {
  font-size: 0.9em;
  font-weight: normal;
  margin-left: 1rem;
  color: var(--color-subtle);
}
@media (max-width: 640px) {
  .dd-statement-group {
    grid-template-columns: 1fr;
  }
}
</style>
