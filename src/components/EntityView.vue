<template>
  <EntitySkeleton v-if="loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article
    v-else-if="entity"
    class="dd-entity"
    :style="{ '--dd-sticky-top': `${titleHeight}px` }"
  >
    <header class="dd-entity-header">
      <div class="dd-entity-title">
        <h1 ref="title">
          {{ label(entity, language) ?? fileName ?? entity.id }}
          <EntityId :id="entity.id" />
        </h1>
        <!-- the file name, unless already the title (without caption) -->
        <p v-if="mediaInfo" class="dd-description">
          {{ label(entity, language) ? fileName : "" }}
        </p>
        <p v-else class="dd-description">
          {{ description(entity, language) ?? t("entity-no-description") }}
        </p>
        <p v-if="aliases.length" class="dd-aliases">
          <cdx-info-chip v-for="alias in aliases" :key="alias">
            {{ alias }}
          </cdx-info-chip>
        </p>
        <p v-if="mediaInfo" class="dd-links">
          <a
            :class="LINK_BUTTON"
            :href="`https://commons.wikimedia.org/wiki/${encodeURIComponent(entity.title ?? entity.id)}`"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconLogoWikimediaCommons" size="small" />
            {{ t("entity-commons") }}
          </a>
        </p>
        <p v-else class="dd-links">
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
          <a
            :class="LINK_BUTTON"
            :href="uploadWizard"
            target="_blank"
            rel="external noopener"
          >
            <cdx-icon :icon="cdxIconUpload" size="small" />
            {{ t("entity-upload") }}
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

    <cdx-tabs v-model:active="tab" :style="tabIcons">
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
            :suggestions="suggested.menu.statements"
            :labels="allLabels"
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
          <cdx-menu-button
            v-model:selected="sort"
            :menu-items="sortItems"
            weight="normal"
            :aria-label="t('sort-statements')"
          >
            <cdx-icon :icon="cdxIconSortVertical" />
            {{ t(`sort-${sort}`) }}
          </cdx-menu-button>
        </div>
        <p v-if="suggested.statements.properties.length" class="dd-suggested">
          {{ suggested.statements.label }}
          <cdx-button
            v-for="property in suggested.statements.properties"
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
        <div v-if="statements.length" class="dd-statements">
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
          :suggestions="suggested.menu.identifiers"
          :labels="allLabels"
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
        <p v-if="suggested.identifiers.properties.length" class="dd-suggested">
          {{ suggested.identifiers.label }}
          <cdx-button
            v-for="property in suggested.identifiers.properties"
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
        <div v-if="identifiers.length" class="dd-statements">
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
          :captions="mediaInfo"
        />
      </cdx-tab>
      <cdx-tab
        v-if="!mediaInfo"
        name="sitelinks"
        :label="t('tab-sitelinks', sitelinks.length)"
      >
        <SitelinksTable v-model:edits="edits" :entity="entity" />
      </cdx-tab>
      <cdx-tab v-if="commonsCategory" name="gallery" :label="t('tab-gallery')">
        <!-- loaded when shown -->
        <CommonsGallery
          v-if="tab === 'gallery'"
          :key="`${commonsCategory}:${language}`"
          :category="commonsCategory"
          :language="language"
        />
      </cdx-tab>
      <cdx-tab name="compare" :label="t('tab-compare')">
        <!-- rendered when shown, the compared item is kept meanwhile -->
        <CompareView
          v-if="tab === 'compare'"
          v-model:other="compareId"
          :entity="entity"
          :properties="orderedProperties"
          :claims-of="claimsOf"
          :language="language"
          :labels="allLabels"
          :descriptions="allDescriptions"
          :formatter-urls="formatterUrls"
          @copy="copyFromOther"
          @swap="swapCompared"
        />
      </cdx-tab>
      <!-- history and links of Wikidata, not (yet) of Commons -->
      <cdx-tab v-if="!mediaInfo" name="history" :label="t('tab-history')">
        <!-- loaded when shown -->
        <HistoryView
          v-if="tab === 'history'"
          :key="`${entity.id}:${language}:${savedRevision}`"
          :id="entity.id"
          :language="language"
        />
      </cdx-tab>
      <cdx-tab v-if="!mediaInfo" name="backlinks" :label="t('tab-backlinks')">
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
      class="dd-entity-qs"
      :id="entity.id"
      :edits="edits"
      :saving="saving"
      :saved-revision="savedRevision"
      @save="save"
    />
  </article>
</template>

<script setup lang="ts">
import { isRTL, language as uiLanguage, locale, t } from "../i18n";
import { computed, ref, shallowRef, toRaw, useTemplateRef, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxInfoChip,
  CdxMenuButton,
  CdxMessage,
  CdxTab,
  CdxTabs,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconArticleRedirect,
  cdxIconDiffs,
  cdxIconHistory,
  cdxIconImageGallery,
  cdxIconKey,
  cdxIconLanguage,
  cdxIconLogoWikidata,
  cdxIconLogoWikimediaCommons,
  cdxIconLogoWikipedia,
  cdxIconPaste,
  cdxIconShareAndroid,
  cdxIconSortVertical,
  cdxIconUpload,
  resolveIcon,
  shouldIconFlip,
  type Icon,
} from "@wikimedia/codex-icons";
import {
  ApiError,
  description,
  editEntity,
  getEntities,
  getLabels,
  getPropertySuggestions,
  isMediaInfo,
  label,
  referencedIds,
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
import {
  until,
  useElementSize,
  useEventListener,
  useLocalStorage,
  useTitle,
} from "@vueuse/core";
import {
  getPropertyOrder,
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
import CompareView from "./CompareView.vue";
import CommonsGallery from "./CommonsGallery.vue";
import HistoryView from "./HistoryView.vue";
import { entityHash } from "../route";
import TermsTable from "./TermsTable.vue";
import StatementGroup from "./StatementGroup.vue";
import QuickStatementsPanel from "./QuickStatementsPanel.vue";

const props = defineProps<{
  id: string;
  /** item compared with (from the URL), opens the Compare tab */
  compare?: string;
  language: string;
}>();

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
const tab = ref(props.compare ? "compare" : "statements");
/** height of the sticky title, property labels stick below it */
const { height: titleHeight } = useElementSize(
  useTemplateRef("title"),
  undefined,
  {
    box: "border-box",
  },
);

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
  // another entity was loaded meanwhile (entity.value is a reactive proxy)
  if (toRaw(entity.value) !== e) return;
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
  // names of the suggested properties
  await getLabels(
    typeProperties.value.filter((p) => !labels.value[p]),
    props.language,
    addLabels,
  );
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
 * Add statements (with qualifiers and references) as new edits, skipping
 * values the item already has; returns the added edits.
 */
function addClaims(claims: Claim[]): Edit[] {
  // compare values in their normalized QuickStatements form
  const key = (snak: Snak) => `${snak.property}|${snakValue(snak)}`;
  const existing = new Set(
    properties.value.flatMap((p) => claimsOf(p).map((c) => key(c.mainsnak))),
  );
  const added: Edit[] = [];
  for (const claim of claims) {
    if (existing.has(key(claim.mainsnak))) continue;
    existing.add(key(claim.mainsnak));
    added.push(claimToEdit(claim, `new-${++counter}`));
  }
  edits.value.push(...added);
  // labels for added values, qualifiers and references
  const ids = referencedIds({
    claims: { _: claims },
  } as unknown as Entity).filter((id) => !labels.value[id]);
  getLabels(ids, props.language, addLabels).catch(console.warn);
  return added;
}

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
  const before = edits.value.length;
  const count = addClaims(data.claims).length;
  edits.value.push(...data.terms);
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

/** item compared with in the Compare tab, in the URL while shown */
const compareId = ref(props.compare);
// from the URL: links and history navigation
watch(
  () => props.compare,
  (compare) => {
    if (compare) {
      compareId.value = compare;
      tab.value = "compare";
    } else if (tab.value === "compare") tab.value = "statements";
  },
);
// to the URL: the user's choices; after the watcher above, so changes from
// the URL are not written back half-applied
watch(
  [tab, compareId],
  ([shown, compare], [, oldCompare]) => {
    const hash = entityHash(
      props.id,
      shown === "compare" ? compare : undefined,
    );
    if (location.hash === hash) return;
    // a new comparison is a history entry, switching tabs is not; both via
    // the hash, so the route (and with it the props) stays in sync
    if (compare !== oldCompare) location.hash = hash;
    else location.replace(hash);
  },
  { flush: "post" },
);

/** Open the compared item, comparing it with this one (unsaved edits are lost). */
function swapCompared(other: string) {
  if (edits.value.length && !confirm(t("compare-swap-discard"))) return;
  location.hash = entityHash(other, props.id);
}

/** Copy statements of the compared item to this one, as edits. */
function copyFromOther(claims: Claim[]) {
  const added = addClaims(claims);
  toast.show({
    type: "success",
    message: t("pasted", added.length, claims.length - added.length),
    actionButton: added.length
      ? {
          label: t("undo"),
          onClick: () =>
            (edits.value = edits.value.filter((e) => !added.includes(e))),
        }
      : undefined,
    autoDismiss: 6000,
  });
}

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
    ...commonProperties.value,
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
  () =>
    (entity.value?.aliases[props.language] ?? entity.value?.aliases.mul)?.map(
      (a) => a.value,
    ) ?? [],
);

const isIdentifier = (property: string) =>
  claimsOf(property)[0]?.mainsnak.datatype === "external-id";
const properties = computed(() => [
  ...new Set([
    ...Object.keys(entity.value?.claims ?? {}),
    ...statementEdits.value.map((e) => e.snak.property),
  ]),
]);
type Sort = "wikidata" | "type" | "alphabetical";
/** user-selected order of statements and identifiers */
const sort = useLocalStorage<Sort>("dinodata.sort", "wikidata");
const sortItems = computed(() =>
  (["wikidata", "type", "alphabetical"] as const).map((value) => ({
    value,
    label: t(`sort-${value}`),
  })),
);
/** property order of Wikidata entity pages, loaded when needed */
const wikidataOrder = shallowRef<Map<string, number>>();
async function loadWikidataOrder() {
  if (sort.value === "alphabetical" || wikidataOrder.value) return;
  try {
    wikidataOrder.value = await getPropertyOrder();
  } catch (e) {
    console.warn(e);
  }
}
watch(sort, loadWikidataOrder);
const collator = computed(
  () => new Intl.Collator(locale(props.language), { numeric: true }),
);
/** Sorted by the user's choice, otherwise keeping the order of the API. */
const orderedProperties = computed(() => {
  const byPosition = (positions: Map<string, number> | undefined) => {
    const rank = (p: string) => positions?.get(p) ?? Infinity;
    // unlisted properties (Infinity - Infinity = NaN) keep their order
    return (a: string, b: string) => rank(a) - rank(b) || 0;
  };
  const wikidata = byPosition(wikidataOrder.value);
  const type = byPosition(new Map(typeProperties.value.map((p, i) => [p, i])));
  const compare: Record<Sort, (a: string, b: string) => number> = {
    wikidata,
    // properties for this type (P1963) first, in their order
    type: (a, b) => type(a, b) || wikidata(a, b),
    alphabetical: (a, b) =>
      collator.value.compare(allLabels.value[a], allLabels.value[b]),
  };
  return [...properties.value].sort(compare[sort.value] ?? wikidata);
});
const statements = computed(() =>
  orderedProperties.value.filter((p) => !isIdentifier(p)),
);
const identifiers = computed(() =>
  orderedProperties.value.filter(isIdentifier),
);
/** Properties for this type (P1963) the item does not have yet. */
/** properties often used with the item's statements (PropertySuggester) */
const commonProperties = ref<string[]>([]);

async function loadCommonProperties(e: Entity) {
  const ids = await getPropertySuggestions(e.id, props.language);
  if (toRaw(entity.value) !== e) return;
  commonProperties.value = ids;
  // names of the suggested properties, before the preload of all properties
  await getLabels(
    ids.filter((p) => !labels.value[p]),
    props.language,
    addLabels,
  );
}

/**
 * Properties the item does not have yet: for its type (P1963), otherwise
 * those often used with its statements; the property menu offers both.
 */
const suggested = computed(() => {
  const external = (p: string) => byId.value[p].datatype === "external-id";
  const split = (ids: string[]) => {
    const missing = ids.filter(
      (p) => byId.value[p] && !properties.value.includes(p),
    );
    return {
      statements: missing.filter((p) => !external(p)),
      identifiers: missing.filter(external),
    };
  };
  const type = split(typeProperties.value);
  const common = split(commonProperties.value);
  const row = (kind: "statements" | "identifiers") =>
    type[kind].length
      ? { label: t("suggested-properties"), properties: type[kind] }
      : { label: t("suggested-common"), properties: common[kind].slice(0, 10) };
  return {
    statements: row("statements"),
    identifiers: row("identifiers"),
    menu: {
      statements: [...new Set([...type.statements, ...common.statements])],
      identifiers: [...new Set([...type.identifiers, ...common.identifiers])],
    },
  };
});

/** Commons category (P373), or the Commons sitelink (usually a category) */
const commons = computed(() => {
  const category = entity.value?.claims.P373?.[0]?.mainsnak.datavalue?.value;
  return category
    ? `Category:${category}`
    : entity.value?.sitelinks?.commonswiki?.title;
});

/** name of the Commons category (P373, or a category sitelink) */
const commonsCategory = computed(
  () => commons.value?.match(/^Category:(.+)$/)?.[1],
);

/** CSS mask image of an icon in the UI language (cf. cdx-mixin-css-icon) */
function iconImage(icon: Icon): string {
  const dir = isRTL() ? "rtl" : "ltr";
  const resolved = resolveIcon(icon, uiLanguage.value, dir);
  let svg =
    typeof resolved === "string" ? resolved : `<path d="${resolved.path}"/>`;
  if (dir === "rtl" && shouldIconFlip(icon, uiLanguage.value))
    svg = `<g transform="matrix(-1 0 0 1 20 0)">${svg}</g>`;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${svg}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(xml)}")`;
}

/** icons of the tabs, in their order, as CdxTabs has no slot for them */
const tabIcons = computed(() => {
  const icons = [
    cdxIconLogoWikidata, // statements
    cdxIconKey, // identifiers
    cdxIconLanguage, // languages
    cdxIconShareAndroid, // sitelinks
    ...(commonsCategory.value ? [cdxIconImageGallery] : []), // media
    cdxIconDiffs, // compare
    cdxIconHistory, // history
    cdxIconArticleRedirect, // what links here
  ];
  return Object.fromEntries(
    icons.map((icon, i) => [`--dd-tab-icon-${i + 1}`, iconImage(icon)]),
  );
});

/** UploadWizard with the Commons category and depicting the entity */
const uploadWizard = computed(() => {
  const params = new URLSearchParams({
    description: `{{Depicts|${entity.value?.id}}}`,
  });
  const category = commonsCategory.value;
  if (category) params.set("categories", category);
  return `https://commons.wikimedia.org/wiki/Special:UploadWizard?${params}`;
});

/** structured data of a Commons file (MediaInfo) */
const mediaInfo = computed(() => isMediaInfo(props.id));
/** name of the Commons file, without `File:` */
const fileName = computed(() =>
  mediaInfo.value ? entity.value?.title?.replace(/^File:/, "") : undefined,
);

const imageFile = computed(() => {
  if (fileName.value) return fileName.value;
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
    referenced.filter((i) => !labels.value[i]),
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
      commonProperties.value = [];
      closeAdding();
    }
    try {
      // browser refresh: bypass the cache for the item first shown;
      // the property order along with it, so statements do not jump
      const [entities] = await Promise.all([
        getEntities([props.id], undefined, undefined, consumeReloadBypass()),
        loadWikidataOrder(),
      ]);
      const e = entities[props.id];
      if (!e || "missing" in e) throw new Error(`${props.id} not found`);
      const referenced = referencedIds(e);
      propertyIds.value = referenced.filter((i) => i.startsWith("P"));
      labels.value = {};
      descriptions.value = {};
      entity.value = e;
      loading.value = false;
      loadTypeProperties(e).catch(console.warn);
      // the PropertySuggester of Wikidata, not for Commons files
      if (!isMediaInfo(e.id)) loadCommonProperties(e).catch(console.warn);
      // the item's properties first: the preload of all properties (for
      // search and editing) may take a while on the first visit
      await getLabels(
        [
          ...referenced.filter((i) => i.startsWith("P")),
          ...referenced.filter((i) => !i.startsWith("P")),
        ],
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
/*
 * The header is flattened into the article grid, so that the title sticks
 * while scrolling through the whole entity, not just the header.
 */
.dd-entity {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto auto 1fr auto auto;
  grid-template-areas:
    "title title"
    "description image"
    "aliases image"
    "links image"
    "tabs tabs"
    "qs qs";
  column-gap: 2rem;
}
.dd-entity-header,
.dd-entity-title {
  display: contents;
}
.dd-entity > :deep(.cdx-tabs) {
  grid-area: tabs;
  margin-top: 1rem;
  min-width: 0;
}
.dd-entity-qs {
  grid-area: qs;
  min-width: 0;
}
.dd-image {
  grid-area: image;
  align-self: start;
  margin-top: 0.5rem;
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
.dd-aliases,
.dd-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.dd-entity h1 {
  grid-area: title;
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0;
  padding: 0.25rem 0;
  background: var(--background-color-base);
}
.dd-description {
  grid-area: description;
  margin: 0 0 0.5rem;
}
.dd-aliases {
  grid-area: aliases;
  align-items: center;
  margin: 0 0 0.5rem;
}
.dd-links {
  grid-area: links;
  align-items: center;
  align-self: start;
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
.dd-entity :deep(.cdx-tabs__list__item > span::before) {
  content: "";
  display: inline-block;
  width: var(--size-icon-small);
  height: var(--size-icon-small);
  margin-inline-end: var(--spacing-25);
  vertical-align: text-bottom;
  background-color: currentcolor;
  mask: var(--dd-tab-icon) no-repeat center / contain;
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(1)) {
  --dd-tab-icon: var(--dd-tab-icon-1);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(2)) {
  --dd-tab-icon: var(--dd-tab-icon-2);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(3)) {
  --dd-tab-icon: var(--dd-tab-icon-3);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(4)) {
  --dd-tab-icon: var(--dd-tab-icon-4);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(5)) {
  --dd-tab-icon: var(--dd-tab-icon-5);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(6)) {
  --dd-tab-icon: var(--dd-tab-icon-6);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(7)) {
  --dd-tab-icon: var(--dd-tab-icon-7);
}
.dd-entity :deep(.cdx-tabs__list__item:nth-child(8)) {
  --dd-tab-icon: var(--dd-tab-icon-8);
}
@media (max-width: 640px) {
  .dd-entity {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-template-areas: "image" "title" "description" "aliases" "links" "tabs" "qs";
  }
  .dd-image {
    max-width: 100%;
  }
}
</style>
