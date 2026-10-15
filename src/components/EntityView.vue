<template>
  <cdx-progress-bar v-if="loading" aria-label="Loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article v-else-if="entity" class="dd-entity">
    <header class="dd-entity-header">
      <div class="dd-entity-title">
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
        <p class="dd-links">
          <a
            :href="`https://www.wikidata.org/wiki/${entity.id}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLinkExternal" size="small" />
            Wikidata
          </a>
          <a
            v-if="entity.sitelinks?.[`${language}wiki`]"
            :href="`https://${language}.wikipedia.org/wiki/${entity.sitelinks[`${language}wiki`].title}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLinkExternal" size="small" />
            Wikipedia
          </a>
        </p>
      </div>
      <img v-if="image" class="dd-image" :src="image" alt="" />
    </header>

    <cdx-tabs v-model:active="tab">
      <cdx-tab name="statements" :label="`Statements (${statements.length})`">
        <AddStatement
          v-if="adding"
          :language="language"
          @add="addStatement"
          @close="adding = false"
        />
        <cdx-button
          v-else
          action="progressive"
          class="dd-add-statement-button"
          @click="adding = true"
        >
          <cdx-icon :icon="cdxIconAdd" />
          Add statement
        </cdx-button>
        <StatementGroup
          v-for="property in statements"
          :key="property"
          :property="property"
          :claims="claimsOf(property)"
          :labels="allLabels"
          :formatter-urls="formatterUrls"
          :language="language"
          :pending="pending"
          :removed="removed"
          @add="addStatement"
          @remove="removeStatement"
          @undo="undo"
        />
      </cdx-tab>
      <cdx-tab
        name="identifiers"
        :label="`Identifiers (${identifiers.length})`"
      >
        <StatementGroup
          v-for="property in identifiers"
          :key="property"
          :property="property"
          :claims="claimsOf(property)"
          :labels="allLabels"
          :formatter-urls="formatterUrls"
          :language="language"
          :pending="pending"
          :removed="removed"
          @add="addStatement"
          @remove="removeStatement"
          @undo="undo"
        />
      </cdx-tab>
      <cdx-tab name="terms" :label="`Languages (${terms.length})`">
        <cdx-table
          caption="Labels, descriptions and aliases"
          :columns="[
            { id: 'language', label: 'Language' },
            { id: 'label', label: 'Label' },
            { id: 'description', label: 'Description' },
            { id: 'aliases', label: 'Also known as' },
          ]"
          :data="terms"
        />
      </cdx-tab>
      <cdx-tab name="sitelinks" :label="`Sitelinks (${sitelinks.length})`">
        <cdx-table
          caption="Sitelinks"
          :columns="[
            { id: 'site', label: 'Site' },
            { id: 'title', label: 'Title' },
          ]"
          :data="sitelinks"
        >
          <template #item-title="{ item, row }">
            <a
              :href="siteUrl(row.site, item)"
              target="_blank"
              rel="external noopener"
            >
              {{ item }}
            </a>
          </template>
        </cdx-table>
      </cdx-tab>
    </cdx-tabs>

    <QuickStatementsPanel :id="entity.id" :edits="edits" />
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxProgressBar,
  CdxTab,
  CdxTable,
  CdxTabs,
} from "@wikimedia/codex";
import { cdxIconAdd, cdxIconLinkExternal } from "@wikimedia/codex-icons";
import {
  getEntities,
  label,
  type Claim,
  type Entity,
  type Snak,
} from "../wikidata";
import type { Edit } from "../quickstatements";
import { propertyLabel, useProperties } from "../properties";
import AddStatement from "./AddStatement.vue";
import StatementGroup from "./StatementGroup.vue";
import QuickStatementsPanel from "./QuickStatementsPanel.vue";

const props = defineProps<{ id: string; language: string }>();

const entity = ref<Entity>();
const labels = ref<Record<string, string>>({});
const formatterUrls = ref<Record<string, string>>({});
const edits = ref<Edit[]>([]);
const loading = ref(false);
const error = ref<string>();
const tab = ref("statements");
const adding = ref(false);
const { byId } = useProperties();

type StatementEdit = Extract<Edit, { type: "statement" }>;
const statementEdits = computed(() =>
  edits.value.filter((e): e is StatementEdit => e.type === "statement"),
);
const pending = computed(
  () =>
    new Set(
      statementEdits.value.filter((e) => !e.remove).map((e) => e.claimId),
    ),
);
const removed = computed(
  () =>
    new Set(statementEdits.value.filter((e) => e.remove).map((e) => e.claimId)),
);

function claimsOf(property: string): Claim[] {
  return [
    ...(entity.value?.claims[property] ?? []),
    ...statementEdits.value
      .filter((e) => !e.remove && e.snak.property === property)
      .map((e) => ({
        id: e.claimId,
        rank: "normal" as const,
        mainsnak: e.snak,
      })),
  ];
}

let counter = 0;
function addStatement(snak: Snak, valueLabel?: string) {
  const id = (snak.datavalue?.value as { id?: string })?.id;
  if (id && valueLabel) labels.value[id] = valueLabel;
  edits.value.push({ type: "statement", claimId: `new-${++counter}`, snak });
}

function removeStatement(claim: Claim) {
  edits.value.push({
    type: "statement",
    claimId: claim.id,
    remove: true,
    snak: claim.mainsnak,
  });
}

function undo(claim: Claim) {
  edits.value = edits.value.filter(
    (e) => e.type !== "statement" || e.claimId !== claim.id,
  );
}

/** Fetched labels, completed with locally preloaded property labels. */
const allLabels = computed(() => {
  const result = { ...labels.value };
  for (const property of [...statements.value, ...identifiers.value]) {
    result[property] ??=
      propertyLabel(byId.value[property], props.language) ?? property;
  }
  return result;
});

const aliases = computed(
  () => entity.value?.aliases[props.language]?.map((a) => a.value) ?? [],
);

const isIdentifier = (property: string) =>
  claimsOf(property)[0]?.mainsnak.datatype === "external-id";
const properties = computed(() => [
  ...new Set([
    ...Object.keys(entity.value?.claims ?? {}),
    ...statementEdits.value.map((e) => e.snak.property),
  ]),
]);
const statements = computed(() =>
  properties.value.filter((p) => !isIdentifier(p)),
);
const identifiers = computed(() => properties.value.filter(isIdentifier));

const image = computed(() => {
  const file = entity.value?.claims.P18?.[0]?.mainsnak.datavalue?.value;
  return file
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(file))}?width=400`
    : undefined;
});

const terms = computed(() => {
  const e = entity.value;
  if (!e) return [];
  const languages = new Set([
    ...Object.keys(e.labels),
    ...Object.keys(e.descriptions),
    ...Object.keys(e.aliases),
  ]);
  return [...languages]
    .sort((a, b) =>
      a === props.language ? -1 : b === props.language ? 1 : a.localeCompare(b),
    )
    .map((language) => ({
      language,
      label: e.labels[language]?.value ?? "",
      description: e.descriptions[language]?.value ?? "",
      aliases: e.aliases[language]?.map((a) => a.value).join(" · ") ?? "",
    }));
});

const sitelinks = computed(() =>
  Object.values(entity.value?.sitelinks ?? {})
    .map(({ site, title }) => ({ site, title }))
    .sort((a, b) => a.site.localeCompare(b.site)),
);

function siteUrl(site: string, title: string): string {
  const project: Record<string, string> = {
    wiki: "wikipedia",
    wikivoyage: "wikivoyage",
    wikiquote: "wikiquote",
    wikisource: "wikisource",
    wikinews: "wikinews",
    wikibooks: "wikibooks",
    wikiversity: "wikiversity",
    wiktionary: "wiktionary",
  };
  const special: Record<string, string> = {
    commonswiki: "commons.wikimedia.org",
    specieswiki: "species.wikimedia.org",
    metawiki: "meta.wikimedia.org",
    wikidatawiki: "www.wikidata.org",
  };
  const m = site.match(
    /^(.+?)(wiki|wikivoyage|wikiquote|wikisource|wikinews|wikibooks|wikiversity|wiktionary)$/,
  );
  const host =
    special[site] ??
    (m ? `${m[1].replace(/_/g, "-")}.${project[m[2]]}.org` : site);
  return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

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
      claim.references?.forEach((r) =>
        Object.values(r.snaks).flat().forEach(visit),
      );
    }
  }
  return [...ids];
}

watch(
  () => [props.id, props.language],
  async ([id], old) => {
    const oldId = old?.[0];
    loading.value = true;
    error.value = undefined;
    if (id !== oldId) edits.value = [];
    try {
      const entities = await getEntities([props.id]);
      const e = entities[props.id];
      if (!e || "missing" in e) throw new Error(`${props.id} not found`);
      const ids = referencedIds(e);
      const [items, properties] = await Promise.all([
        getEntities(
          ids.filter((i) => !i.startsWith("P")),
          "labels",
        ),
        getEntities(
          ids.filter((i) => i.startsWith("P")),
          "labels|claims",
        ),
      ]);
      const referenced = { ...items, ...properties };
      labels.value = Object.fromEntries(
        Object.entries(referenced).map(([i, r]) => [
          i,
          label(r, props.language) ?? i,
        ]),
      );
      formatterUrls.value = Object.fromEntries(
        Object.entries(properties).flatMap(([i, p]) => {
          const url = p.claims?.P1630?.[0]?.mainsnak.datavalue?.value;
          return url ? [[i, String(url)]] : [];
        }),
      );
      entity.value = e;
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
.dd-entity-header {
  display: flex;
  gap: 2rem;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.dd-image {
  max-width: 300px;
  max-height: 240px;
  border-radius: var(--border-radius-base);
  box-shadow: var(--box-shadow-medium);
}
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
.dd-links {
  display: flex;
  gap: 1rem;
}
.dd-add-statement-button {
  margin-bottom: 0.75rem;
}
.dd-entity :deep(.cdx-tab) {
  padding-top: 1rem;
}
@media (max-width: 640px) {
  .dd-entity-header {
    flex-direction: column-reverse;
  }
  .dd-image {
    max-width: 100%;
  }
}
</style>
