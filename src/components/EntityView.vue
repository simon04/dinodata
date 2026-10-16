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
            :class="LINK_BUTTON"
            :href="`https://www.wikidata.org/wiki/${entity.id}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLogoWikidata" size="small" />
            {{ t("entity-wikidata") }}
          </a>
          <a
            v-if="entity.sitelinks?.[`${language}wiki`]"
            :class="LINK_BUTTON"
            :href="`https://${language}.wikipedia.org/wiki/${entity.sitelinks[`${language}wiki`].title}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLogoWikipedia" size="small" />
            {{ t("entity-wikipedia") }}
          </a>
          <a
            v-if="commons"
            :class="LINK_BUTTON"
            :href="`https://commons.wikimedia.org/wiki/${encodeURIComponent(commons)}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLogoWikimediaCommons" size="small" />
            {{ t("entity-commons") }}
          </a>
        </p>
      </div>
      <button
        v-if="imageFile"
        class="dd-image"
        :aria-label="t('media-enlarge')"
        @click="mediaFile = imageFile"
      >
        <img :src="image" alt="" />
      </button>
    </header>

    <cdx-tabs v-model:active="tab">
      <cdx-tab
        name="statements"
        :label="t('tab-statements', statements.length)"
      >
        <div class="dd-toolbar">
          <AddStatement
            v-if="
              adding ||
              (addingProperty && addingProperty.datatype !== 'external-id')
            "
            :key="addingProperty?.id"
            :language="language"
            :fixed-property="addingProperty"
            @add="addStatement"
            @close="closeAdding"
          />
          <cdx-button v-else action="progressive" @click="adding = true">
            <cdx-icon :icon="cdxIconAdd" />
            {{ t("add-statement") }}
          </cdx-button>
          <cdx-button class="dd-paste" @click="pasteFromButton">
            <cdx-icon :icon="cdxIconPaste" />
            {{ t("paste-statements") }}
          </cdx-button>
        </div>
        <p v-if="suggested.statements.length" class="dd-suggested">
          {{ t("suggested-properties") }}
          <cdx-button
            v-for="property in suggested.statements"
            :key="property"
            weight="quiet"
            size="small"
            v-tooltip="allDescriptions[property]"
            @click="addProperty(property)"
          >
            <cdx-icon :icon="cdxIconAdd" size="small" />
            {{ allLabels[property] }}
          </cdx-button>
        </p>
        <div class="dd-statements">
          <StatementGroup
            v-for="property in statements"
            :key="property"
            :property="property"
            :claims="claimsOf(property)"
            :labels="allLabels"
            :descriptions="allDescriptions"
            :formatter-urls="formatterUrls"
            :language="language"
            :pending="pending"
            :changed="changed"
            :removed="removed"
            @add="addStatement"
            @remove="removeStatement"
            @undo="undo"
            @copy="copy"
            @change="changeStatement"
            @qualifiers="changeQualifiers"
          />
        </div>
      </cdx-tab>
      <cdx-tab
        name="identifiers"
        :label="t('tab-identifiers', identifiers.length)"
      >
        <AddStatement
          v-if="addingIdentifier || addingProperty?.datatype === 'external-id'"
          :key="addingProperty?.id"
          :language="language"
          :fixed-property="addingProperty"
          @add="addStatement"
          @close="closeAdding"
        />
        <cdx-button
          v-else
          action="progressive"
          @click="addingIdentifier = true"
        >
          <cdx-icon :icon="cdxIconAdd" />
          {{ t("add-statement") }}
        </cdx-button>
        <p v-if="suggested.identifiers.length" class="dd-suggested">
          {{ t("suggested-properties") }}
          <cdx-button
            v-for="property in suggested.identifiers"
            :key="property"
            weight="quiet"
            size="small"
            v-tooltip="allDescriptions[property]"
            @click="addProperty(property)"
          >
            <cdx-icon :icon="cdxIconAdd" size="small" />
            {{ allLabels[property] }}
          </cdx-button>
        </p>
        <div class="dd-statements">
          <StatementGroup
            v-for="property in identifiers"
            :key="property"
            :property="property"
            :claims="claimsOf(property)"
            :labels="allLabels"
            :descriptions="allDescriptions"
            :formatter-urls="formatterUrls"
            :language="language"
            :pending="pending"
            :changed="changed"
            :removed="removed"
            @add="addStatement"
            @remove="removeStatement"
            @undo="undo"
            @copy="copy"
            @change="changeStatement"
            @qualifiers="changeQualifiers"
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
      <cdx-tab name="backlinks" :label="t('tab-backlinks')">
        <!-- loaded when shown, the tab content is only hidden otherwise -->
        <WhatLinksHere
          v-if="tab === 'backlinks'"
          :key="`${entity.id}:${language}`"
          :id="entity.id"
          :language="language"
        />
      </cdx-tab>
    </cdx-tabs>

    <QuickStatementsPanel
      :id="entity.id"
      :edits="edits"
      :saving="saving"
      :saved-revision="savedRevision"
      @save="save"
    />
  </article>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, ref, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMessage,
  CdxTab,
  CdxTabs,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconLogoWikidata,
  cdxIconLogoWikimediaCommons,
  cdxIconLogoWikipedia,
  cdxIconPaste,
} from "@wikimedia/codex-icons";
import {
  ApiError,
  editEntity,
  getEntities,
  getLabels,
  label,
  type Claim,
  type Entity,
  type Snak,
} from "../wikidata";
import { snakValue, toQuickStatements, type Edit } from "../quickstatements";
import { consumeReloadBypass } from "../cache";
import { useAuth } from "../auth";
import { toEntityData } from "../edit";
import {
  claimToEdit,
  copyClaims,
  parseEntityJson,
  parseStatements,
} from "../clipboard";
import { until, useEventListener, useTitle } from "@vueuse/core";
import {
  propertyDescription,
  propertyLabel,
  useProperties,
  type Property,
} from "../properties";
import { useMediaDialog } from "../commons";
import AddStatement from "./AddStatement.vue";
import EntityId from "./EntityId.vue";
import EntitySkeleton from "./EntitySkeleton.vue";
import SitelinksTable from "./SitelinksTable.vue";
import WhatLinksHere from "./WhatLinksHere.vue";
import TermsTable from "./TermsTable.vue";
import StatementGroup from "./StatementGroup.vue";
import QuickStatementsPanel from "./QuickStatementsPanel.vue";

const props = defineProps<{ id: string; language: string }>();

/** Codex link styled as a button ("fake button") */
const LINK_BUTTON = [
  "cdx-button",
  "cdx-button--fake-button",
  "cdx-button--fake-button--enabled",
];

const entity = ref<Entity>();
const labels = ref<Record<string, string>>({});
const descriptions = ref<Record<string, string>>({});
function addLabels(
  batch: Record<string, string>,
  batchDescriptions: Record<string, string>,
) {
  Object.assign(labels.value, batch);
  Object.assign(descriptions.value, batchDescriptions);
}
/** properties used in statements, qualifiers and references */
const propertyIds = ref<string[]>([]);
const edits = ref<Edit[]>([]);
const loading = ref(false);
const error = ref<string>();
const tab = ref("statements");

// restores "DinoData" on unmount
useTitle(
  computed(() => {
    const e = entity.value;
    return e
      ? [e.id, label(e, props.language), "DinoData"].filter(Boolean).join(" · ")
      : `${props.id} · DinoData`;
  }),
);
const adding = ref(false);
const addingIdentifier = ref(false);
/** property chosen from the suggestions */
const addingProperty = ref<Property>();
const { byId } = useProperties();
/** "properties for this type" (P1963) of the item's classes (P31) */
const typeProperties = ref<string[]>([]);

function addProperty(property: string) {
  addingProperty.value = byId.value[property];
}

function closeAdding() {
  adding.value = false;
  addingIdentifier.value = false;
  addingProperty.value = undefined;
}

async function loadTypeProperties(e: Entity) {
  const classes = (e.claims.P31 ?? []).flatMap((c) => {
    const id = (c.mainsnak.datavalue?.value as { id?: string })?.id;
    return id && c.rank !== "deprecated" ? [id] : [];
  });
  const result = classes.length ? await getEntities(classes, "claims") : {};
  if (entity.value !== e) return;
  typeProperties.value = [
    ...new Set(
      classes.flatMap((id) =>
        (result[id]?.claims?.P1963 ?? []).flatMap((c) => {
          const p = (c.mainsnak.datavalue?.value as { id?: string })?.id;
          return p && c.rank !== "deprecated" ? [p] : [];
        }),
      ),
    ),
  ];
}

type StatementEdit = Extract<Edit, { type: "statement" }>;
const statementEdits = computed(() =>
  edits.value.filter((e): e is StatementEdit => e.type === "statement"),
);
const pending = computed(
  () =>
    new Set(
      statementEdits.value
        .filter((e) => !e.remove && !e.original)
        .map((e) => e.claimId),
    ),
);
const changed = computed(
  () =>
    new Set(
      statementEdits.value.filter((e) => e.original).map((e) => e.claimId),
    ),
);
const removed = computed(
  () =>
    new Set(statementEdits.value.filter((e) => e.remove).map((e) => e.claimId)),
);

function claimsOf(property: string): Claim[] {
  const replaced = new Map(
    statementEdits.value.filter((e) => e.original).map((e) => [e.claimId, e]),
  );
  return [
    ...(entity.value?.claims[property] ?? []).map((claim) => {
      const edit = replaced.get(claim.id);
      return edit
        ? {
            ...claim,
            mainsnak: edit.snak,
            qualifiers: edit.qualifiers?.length
              ? groupSnaks(edit.qualifiers)
              : undefined,
          }
        : claim;
    }),
    ...statementEdits.value
      .filter((e) => !e.remove && !e.original && e.snak.property === property)
      .map((e) => ({
        id: e.claimId,
        rank: e.rank ?? "normal",
        mainsnak: e.snak,
        qualifiers: e.qualifiers?.length ? groupSnaks(e.qualifiers) : undefined,
        references: e.references?.map((r) => ({ snaks: groupSnaks(r) })),
      })),
  ];
}

let counter = 0;
function groupSnaks(snaks: Snak[]): Record<string, Snak[]> {
  const result: Record<string, Snak[]> = {};
  for (const snak of snaks) (result[snak.property] ??= []).push(snak);
  return result;
}

const toast = useToast();

/**
 * Paste QuickStatements or `Pxxx=value` lines (or Wikidata entity JSON),
 * skipping values the item already has.
 */
async function pasteClaims(text: string | undefined): Promise<void> {
  if (!text) return;
  const entityClaims = parseEntityJson(text);
  if (!entityClaims && !propertiesLoaded()) {
    // validating values needs the property datatypes
    toast.info(t("property-loading"), { autoDismiss: true });
    await until(propertiesLoaded).toBe(true);
  }
  const data = entityClaims
    ? { claims: entityClaims, terms: [], invalid: [] }
    : parseStatements(text, byId.value, props.language);
  if (!data || (!data.claims.length && !data.terms.length)) {
    toast.warning(t("paste-empty"), { autoDismiss: 8000 });
    return;
  }
  // compare values in their normalized QuickStatements form
  const key = (snak: Snak) => `${snak.property}|${snakValue(snak)}`;
  const existing = new Set(
    properties.value.flatMap((p) => claimsOf(p).map((c) => key(c.mainsnak))),
  );
  const before = edits.value.length;
  let count = 0;
  for (const claim of data.claims) {
    if (existing.has(key(claim.mainsnak))) continue;
    existing.add(key(claim.mainsnak));
    edits.value.push(claimToEdit(claim, `new-${++counter}`));
    count++;
  }
  edits.value.push(...data.terms);
  // labels for pasted values, qualifiers and references
  const ids = referencedIds({
    claims: { _: data.claims },
  } as unknown as Entity).filter(
    (id) => !id.startsWith("P") && !labels.value[id],
  );
  getLabels(ids, props.language, addLabels).catch(console.warn);
  const pasted = edits.value.slice(before);
  toast.show({
    type: data.invalid.length ? "warning" : "success",
    message: [
      t("pasted", count, data.claims.length - count),
      ...(data.terms.length ? [t("pasted-terms", data.terms.length)] : []),
      ...(data.invalid.length
        ? [t("paste-invalid", data.invalid.length, data.invalid.join("; "))]
        : []),
    ].join(" · "),
    // Codex: actions such as Undo must not rely on auto-dismiss alone
    actionButton: pasted.length
      ? {
          label: t("undo"),
          onClick: () =>
            (edits.value = edits.value.filter((e) => !pasted.includes(e))),
        }
      : undefined,
    autoDismiss: data.invalid.length ? false : 6000,
  });
}

const propertiesLoaded = () => Object.keys(byId.value).length > 0;

async function pasteFromButton() {
  try {
    await pasteClaims(await navigator.clipboard.readText());
  } catch {
    // clipboard read denied: Ctrl+V still works via the paste event
    toast.warning(t("paste-denied"), { autoDismiss: 6000 });
  }
}

// Ctrl+V anywhere on the page, except in inputs
useEventListener(document, "paste", (event: ClipboardEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable]")) return;
  event.preventDefault();
  pasteClaims(event.clipboardData?.getData("text/plain"));
});

async function copy(claims: Claim[]) {
  await copyClaims(claims, props.id);
  toast.success(t("copied-statements", claims.length), { autoDismiss: true });
}

function addStatement(snak: Snak, valueLabel?: string) {
  const id = (snak.datavalue?.value as { id?: string })?.id;
  if (id && valueLabel) labels.value[id] = valueLabel;
  edits.value.push({ type: "statement", claimId: `new-${++counter}`, snak });
}

function rememberLabel(snak: Snak | undefined, valueLabel?: string) {
  const id = (snak?.datavalue?.value as { id?: string })?.id;
  if (id && valueLabel) labels.value[id] = valueLabel;
}

/** Change the main value; qualifiers and references are kept. */
function changeStatement(claim: Claim, snak: Snak, valueLabel?: string) {
  rememberLabel(snak, valueLabel);
  updateStatement({ ...claim, mainsnak: snak });
}

/** Change the qualifiers; the main value and references are kept. */
function changeQualifiers(
  claim: Claim,
  qualifiers: Record<string, Snak[]>,
  snak?: Snak,
  valueLabel?: string,
) {
  rememberLabel(snak, valueLabel);
  updateStatement({
    ...claim,
    qualifiers: Object.keys(qualifiers).length ? qualifiers : undefined,
  });
}

/**
 * Pending statements are changed in place; for existing ones the original is
 * kept to export only the difference, unless the change was reverted.
 */
function updateStatement(updated: Claim) {
  const pendingEdit = statementEdits.value.find(
    (e) => e.claimId === updated.id && !e.remove && !e.original,
  );
  if (pendingEdit) {
    pendingEdit.snak = updated.mainsnak;
    pendingEdit.qualifiers = Object.values(updated.qualifiers ?? {}).flat();
    return;
  }
  const original = entity.value?.claims[updated.mainsnak.property]?.find(
    (c) => c.id === updated.id,
  );
  edits.value = edits.value.filter(
    (e) => e.type !== "statement" || e.claimId !== updated.id,
  );
  if (!original) return;
  const edit = claimToEdit(
    {
      ...original,
      mainsnak: updated.mainsnak,
      qualifiers: updated.qualifiers,
    },
    updated.id,
  );
  const unchanged =
    toQuickStatements(props.id, [edit]) ===
    toQuickStatements(props.id, [claimToEdit(original, updated.id)]);
  if (!unchanged)
    edits.value.push({
      ...edit,
      original: {
        snak: original.mainsnak,
        qualifiers: Object.values(original.qualifiers ?? {}).flat(),
      },
    });
}

function removeStatement(claim: Claim) {
  // removing a changed statement removes the original
  edits.value = edits.value.filter(
    (e) => e.type !== "statement" || e.claimId !== claim.id,
  );
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
  for (const property of [
    ...propertyIds.value,
    ...properties.value,
    ...typeProperties.value,
    // qualifiers added in the editor
    ...statementEdits.value.flatMap((e) =>
      (e.qualifiers ?? []).map((q) => q.property),
    ),
  ]) {
    result[property] ??=
      propertyLabel(byId.value[property], props.language) ?? property;
  }
  return result;
});

/** Fetched descriptions, completed with locally preloaded property descriptions. */
const allDescriptions = computed(() => {
  const result = { ...descriptions.value };
  for (const property of Object.keys(allLabels.value)) {
    if (!property.startsWith("P")) continue;
    const d = propertyDescription(byId.value[property], props.language);
    if (d) result[property] ??= d;
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
/** Properties for this type (P1963) first, in their order. */
const orderedProperties = computed(() => {
  const index = new Map(typeProperties.value.map((p, i) => [p, i]));
  const rank = (p: string) => index.get(p) ?? index.size;
  return [...properties.value].sort((a, b) => rank(a) - rank(b));
});
const statements = computed(() =>
  orderedProperties.value.filter((p) => !isIdentifier(p)),
);
const identifiers = computed(() =>
  orderedProperties.value.filter(isIdentifier),
);
/** Properties for this type (P1963) the item does not have yet. */
const suggested = computed(() => {
  const missing = typeProperties.value.filter(
    (p) => byId.value[p] && !properties.value.includes(p),
  );
  const external = (p: string) => byId.value[p].datatype === "external-id";
  return {
    statements: missing.filter((p) => !external(p)),
    identifiers: missing.filter(external),
  };
});

/** Commons category (P373), or the Commons sitelink (usually a category) */
const commons = computed(() => {
  const category = entity.value?.claims.P373?.[0]?.mainsnak.datavalue?.value;
  return category
    ? `Category:${category}`
    : entity.value?.sitelinks?.commonswiki?.title;
});

const imageFile = computed(() => {
  const file = entity.value?.claims.P18?.[0]?.mainsnak.datavalue?.value;
  return file ? String(file) : undefined;
});
const image = computed(
  () =>
    imageFile.value &&
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile.value)}?width=400`,
);
const mediaFile = useMediaDialog();

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

const { username, accessToken } = useAuth();
const saving = ref(false);
const savedRevision = ref<number>();

/** Save all pending edits in one revision. */
async function save(summary: string) {
  const e = entity.value;
  if (!e?.lastrevid || !username.value || !accessToken.value) return;
  saving.value = true;
  try {
    const { lastrevid } = await editEntity(e.id, toEntityData(e, edits.value), {
      baserevid: e.lastrevid,
      // edits are tagged with the OAuth consumer ("DinoData") anyway
      summary,
      auth: { accessToken: accessToken.value, username: username.value },
    });
    edits.value = [];
    savedRevision.value = lastrevid;
    await reload();
  } catch (err) {
    toast.error(
      err instanceof ApiError && err.code === "editconflict"
        ? t("save-conflict")
        : t("save-failed", err instanceof Error ? err.message : String(err)),
    );
  } finally {
    saving.value = false;
  }
}

/** Fetch the saved entity, bypassing the cache, without the skeleton. */
async function reload() {
  const e = (await getEntities([props.id], undefined, undefined, true))[
    props.id
  ];
  if (!e) return;
  const referenced = referencedIds(e);
  propertyIds.value = referenced.filter((i) => i.startsWith("P"));
  entity.value = e;
  await getLabels(
    referenced.filter((i) => !i.startsWith("P") && !labels.value[i]),
    props.language,
    addLabels,
  );
}

watch(
  () => [props.id, props.language],
  async ([id], old) => {
    const oldId = old?.[0];
    loading.value = true;
    error.value = undefined;
    if (id !== oldId) {
      edits.value = [];
      savedRevision.value = undefined;
      typeProperties.value = [];
      closeAdding();
    }
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
      descriptions.value = {};
      entity.value = e;
      loading.value = false;
      loadTypeProperties(e).catch(console.warn);
      await getLabels(
        // fall back to the API for property labels until the cache is loaded
        Object.keys(byId.value).length
          ? referenced.filter((i) => !i.startsWith("P"))
          : referenced,
        props.language,
        addLabels,
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
  display: flex;
  border: none;
  padding: 0;
  background: none;
  cursor: zoom-in;
}
.dd-image img {
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
/* many single-valued identifiers: flow them in columns */
.dd-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.dd-suggested {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin: 0.5rem 0 0;
  color: var(--color-subtle);
}
.dd-toolbar > .dd-add-statement {
  flex-basis: 100%;
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
