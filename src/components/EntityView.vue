<template>
  <EntitySkeleton v-if="loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article v-else-if="entity" class="dd-entity">
    <header class="dd-entity-header">
      <div class="dd-entity-title">
        <h1>
          {{ label(entity, language) ?? entity.id }}
          <EntityId :id="entity.id" />
        </h1>
        <p class="dd-description">
          {{
            entity.descriptions[language]?.value ?? t("entity-no-description")
          }}
        </p>
        <p class="dd-aliases">
          <cdx-info-chip v-for="alias in aliases" :key="alias">
            {{ alias }}
          </cdx-info-chip>
          <a
            :href="`https://www.wikidata.org/wiki/${entity.id}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLinkExternal" size="small" />
            {{ t("entity-wikidata") }}
          </a>
          <a
            v-if="entity.sitelinks?.[`${language}wiki`]"
            :href="`https://${language}.wikipedia.org/wiki/${entity.sitelinks[`${language}wiki`].title}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLinkExternal" size="small" />
            {{ t("entity-wikipedia") }}
          </a>
        </p>
      </div>
      <img v-if="image" class="dd-image" :src="image" alt="" />
    </header>

    <cdx-tabs v-model:active="tab">
      <cdx-tab
        name="statements"
        :label="t('tab-statements', statements.length)"
      >
        <AddStatement
          v-if="adding"
          :language="language"
          @add="addStatement"
          @close="adding = false"
        />
        <cdx-button v-else action="progressive" @click="adding = true">
          <cdx-icon :icon="cdxIconAdd" />
          {{ t("add-statement") }}
        </cdx-button>
        <div class="dd-statements">
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
        </div>
      </cdx-tab>
      <cdx-tab
        name="identifiers"
        :label="t('tab-identifiers', identifiers.length)"
      >
        <AddStatement
          v-if="addingIdentifier"
          :language="language"
          @add="addStatement"
          @close="addingIdentifier = false"
        />
        <cdx-button
          v-else
          action="progressive"
          @click="addingIdentifier = true"
        >
          <cdx-icon :icon="cdxIconAdd" />
          {{ t("add-statement") }}
        </cdx-button>
        <div class="dd-statements dd-identifiers">
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
        </div>
      </cdx-tab>
      <cdx-tab name="terms" :label="t('tab-languages', terms.length)">
        <TermsTable
          v-model:edits="edits"
          :entity="entity"
          :language="language"
        />
      </cdx-tab>
      <cdx-tab name="sitelinks" :label="t('tab-sitelinks', sitelinks.length)">
        <SitelinksTable v-model:edits="edits" :entity="entity" />
      </cdx-tab>
    </cdx-tabs>

    <QuickStatementsPanel :id="entity.id" :edits="edits" />
  </article>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, onUnmounted, ref, watch, watchEffect } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxTab,
  CdxTabs,
} from "@wikimedia/codex";
import { cdxIconAdd, cdxIconLinkExternal } from "@wikimedia/codex-icons";
import {
  getEntities,
  getLabels,
  label,
  type Claim,
  type Entity,
  type Snak,
} from "../wikidata";
import type { Edit } from "../quickstatements";
import { consumeReloadBypass } from "../cache";
import { propertyLabel, useProperties } from "../properties";
import AddStatement from "./AddStatement.vue";
import EntityId from "./EntityId.vue";
import EntitySkeleton from "./EntitySkeleton.vue";
import SitelinksTable from "./SitelinksTable.vue";
import TermsTable from "./TermsTable.vue";
import StatementGroup from "./StatementGroup.vue";
import QuickStatementsPanel from "./QuickStatementsPanel.vue";

const props = defineProps<{ id: string; language: string }>();

const entity = ref<Entity>();
const labels = ref<Record<string, string>>({});
/** properties used in statements, qualifiers and references */
const propertyIds = ref<string[]>([]);
const edits = ref<Edit[]>([]);
const loading = ref(false);
const error = ref<string>();
const tab = ref("statements");

watchEffect(() => {
  const e = entity.value;
  document.title = e
    ? [e.id, label(e, props.language), "DinoData"].filter(Boolean).join(" · ")
    : `${props.id} · DinoData`;
});
onUnmounted(() => (document.title = "DinoData"));
const adding = ref(false);
const addingIdentifier = ref(false);
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

const formatterUrls = computed(() =>
  Object.fromEntries(
    properties.value.flatMap((p) => {
      const url = byId.value[p]?.formatterUrl;
      return url ? [[p, url]] : [];
    }),
  ),
);

/** Fetched labels, completed with locally preloaded property labels. */
const allLabels = computed(() => {
  const result = { ...labels.value };
  for (const property of [...propertyIds.value, ...properties.value]) {
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
  return e
    ? [
        ...new Set([
          ...Object.keys(e.labels),
          ...Object.keys(e.descriptions),
          ...Object.keys(e.aliases),
        ]),
      ]
    : [];
});

const sitelinks = computed(() => Object.keys(entity.value?.sitelinks ?? {}));

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
      // browser refresh: bypass the cache for the item first shown
      const entities = await getEntities(
        [props.id],
        undefined,
        undefined,
        consumeReloadBypass(),
      );
      const e = entities[props.id];
      if (!e || "missing" in e) throw new Error(`${props.id} not found`);
      // properties come from the local cache, only fetch item labels
      const referenced = referencedIds(e);
      propertyIds.value = referenced.filter((i) => i.startsWith("P"));
      labels.value = {};
      entity.value = e;
      loading.value = false;
      await getLabels(
        // fall back to the API for property labels until the cache is loaded
        Object.keys(byId.value).length
          ? referenced.filter((i) => !i.startsWith("P"))
          : referenced,
        props.language,
        (batch) => Object.assign(labels.value, batch),
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
.dd-entity-header {
  display: flex;
  gap: 2rem;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.dd-image {
  max-width: 300px;
  max-height: 160px;
  border-radius: var(--border-radius-base);
  box-shadow: var(--box-shadow-medium);
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
.dd-entity h1 {
  margin: 0.25rem 0;
}
.dd-description {
  margin: 0 0 0.5rem;
}
.dd-aliases {
  align-items: center;
  margin: 0;
}
.dd-aliases a {
  margin-left: 0.5rem;
}
/* many single-valued identifiers: flow them in columns */
.dd-identifiers {
  columns: 34rem;
  column-gap: 0;
}
.dd-identifiers :deep(.dd-statement-group) {
  break-inside: avoid;
}
.dd-statements {
  margin-top: 0.75rem;
  border: 1px solid var(--border-color-subtle);
  border-bottom: none;
  border-radius: var(--border-radius-base);
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
