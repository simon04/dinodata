<template>
  <EntitySkeleton v-if="loading" />
  <cdx-message v-else-if="error" type="error">{{ error }}</cdx-message>
  <article v-else-if="element" class="dd-osm">
    <!-- like the entity header: flattened into the article grid -->
    <header class="dd-osm-header">
      <h1>
        {{ title }}
        <EntityId :id="shortRef(osmRef)" />
      </h1>
      <button
        type="button"
        class="dd-osm-preset"
        :aria-label="t('osm-preset-change')"
        v-tooltip="t('osm-preset-change')"
        @click="sheet = { kind: 'preset' }"
      >
        <PresetIcon :icon="preset?.icon" />
        {{ preset?.name ?? t("loading") }}
        <cdx-icon :icon="cdxIconEdit" size="x-small" />
      </button>
      <p class="dd-osm-meta">
        {{
          t(
            "osm-last-edit",
            formatRelativeTime(element.timestamp, language),
            element.user ?? "?",
            element.version,
          )
        }}
      </p>
      <p class="dd-osm-links">
        <a
          :class="LINK_BUTTON"
          :href="elementUrl(osmRef)"
          target="_blank"
          rel="external noopener"
        >
          <cdx-icon :icon="cdxIconMapPin" size="small" />
          {{ t("osm-openstreetmap") }}
        </a>
        <a
          :class="LINK_BUTTON"
          :href="editUrl(osmRef)"
          target="_blank"
          rel="external noopener"
        >
          <cdx-icon :icon="cdxIconEdit" size="small" />
          iD
        </a>
        <a v-if="wikidataId" :class="LINK_BUTTON" :href="`#${wikidataId}`">
          <cdx-icon :icon="cdxIconLogoWikidata" size="small" />
          {{ t("entity-wikidata") }}
        </a>
      </p>
      <StaticMap
        v-if="bounds"
        class="dd-osm-map"
        :bounds="bounds"
        :href="elementUrl(osmRef)"
      />
    </header>

    <OsmIssues
      :issues="issues"
      @fix="patch"
      @info="(key) => (sheet = { kind: 'info', key })"
    />

    <section class="dd-osm-tags">
      <div class="dd-osm-actions">
        <cdx-button action="progressive" @click="sheet = { kind: 'add' }">
          <cdx-icon :icon="cdxIconAdd" />
          {{ t("osm-add") }}
        </cdx-button>
        <cdx-button @click="pasteFromButton">
          <cdx-icon :icon="cdxIconPaste" />
          {{ t("osm-paste") }}
        </cdx-button>
        <cdx-button @click="openText">
          <cdx-icon :icon="cdxIconTextFlow" />
          {{ t("osm-text-view") }}
        </cdx-button>
      </div>
      <!-- one list like the statements: preset fields, then the other tags -->
      <div class="dd-osm-box">
        <FieldEditor
          v-for="field in visibleFields"
          :key="field.id"
          :field="field"
          :tags="current"
          :base="base"
          :language="language"
          @patch="patch"
          @pick="(key, multi) => (sheet = { kind: 'pick', key, field, multi })"
          @info="(key) => (sheet = { kind: 'info', key })"
          @copy="copyTags"
        />
        <template v-if="otherKeys.length">
          <h2 v-if="visibleFields.length" class="dd-osm-box-heading">
            {{ t("osm-other-tags", otherKeys.length) }}
          </h2>
          <ul>
            <TagRow
              v-for="key in otherKeys"
              :key="key"
              :tag-key="key"
              :value="current[key] ?? base[key]"
              :value-label="optionLabel(key, current[key] ?? base[key])"
              :description="describe(key, current[key] ?? base[key])"
              :discouraged="isDiscouraged(key, current[key] ?? base[key])"
              :state="tagState(base, current, key)"
              @open="sheet = { kind: 'tag', key }"
              @copy="copyTags({ [key]: current[key] ?? base[key] })"
            />
          </ul>
        </template>
      </div>
    </section>

    <section v-if="parents.length">
      <h2>{{ t("osm-part-of") }}</h2>
      <ul class="dd-osm-parents">
        <li v-for="parent in parents" :key="`${parent.type}${parent.id}`">
          <a :href="osmHash(parent)">
            <PresetIcon :icon="presetOf(parent)?.icon" />
            {{ elementTitle(parent) }}
          </a>
          <code class="dd-id-chip">{{ shortRef(parent) }}</code>
          <span class="dd-osm-subtle">{{ presetOf(parent)?.name }}</span>
        </li>
      </ul>
    </section>

    <div v-if="changes.length || conflicts.length" class="dd-osm-bar">
      <cdx-button weight="quiet" @click="sheet = { kind: 'review' }">
        {{ t("osm-changes", changes.length) }}
      </cdx-button>
      <cdx-button
        action="progressive"
        weight="primary"
        @click="sheet = { kind: 'review' }"
      >
        <cdx-icon :icon="cdxIconUpload" />
        {{ t("osm-review") }}
      </cdx-button>
    </div>

    <BottomSheet
      :open="!!sheet"
      :title="sheetTitle"
      @update:open="(open) => !open && (sheet = undefined)"
    >
      <template v-if="sheet?.kind === 'tag' || sheet?.kind === 'info'">
        <TagInfo
          :tag-key="sheet.key"
          :value="current[sheet.key]"
          :key-doc="docs[sheet.key]"
          :value-doc="docs[`${sheet.key}=${current[sheet.key]}`]"
          :item-labels="itemLabels"
        />
        <ValuePicker
          v-if="sheet.kind === 'tag'"
          ref="picker"
          :key="sheet.key"
          :tag-key="sheet.key"
          :value="current[sheet.key]"
          :options="sheetField?.options"
          :language="language"
          @update="onPick"
        />
      </template>
      <ValuePicker
        v-else-if="sheet?.kind === 'pick'"
        ref="picker"
        :key="sheet.key"
        :tag-key="sheet.key"
        :value="current[sheet.key]"
        :options="sheet.field.options"
        :multi="sheet.multi"
        :custom-values="sheet.field.customValues"
        :placeholder="sheet.field.placeholder"
        :language="language"
        @update="onPick"
      />
      <AddTag
        v-else-if="sheet?.kind === 'add'"
        :schema="schema"
        :fields="addableFields"
        :language="language"
        @field="addField"
        @patch="(p) => (patch(p), (sheet = undefined))"
      />
      <PresetPicker
        v-else-if="sheet?.kind === 'preset' && schema"
        :schema="schema"
        :geometry="geometry"
        :current="preset?.id"
        @select="changePreset"
      />
      <template v-else-if="sheet?.kind === 'text'">
        <p class="dd-osm-subtle">{{ t("osm-text-hint") }}</p>
        <cdx-text-area
          v-model="text"
          class="dd-osm-text"
          :aria-label="t('osm-text-view')"
          rows="12"
          autocapitalize="off"
          spellcheck="false"
        />
      </template>
      <template v-else-if="sheet?.kind === 'review'">
        <cdx-message v-if="conflicts.length" type="warning">
          {{ t("osm-conflict") }}
        </cdx-message>
        <div
          v-for="conflict in conflicts"
          :key="conflict.key"
          class="dd-osm-conflict"
        >
          <code>{{ conflict.key }}</code>
          <ChoiceChips
            :options="conflictOptions(conflict)"
            :selected="[]"
            :label="conflict.key"
            @toggle="(v) => resolveConflict(conflict.key, v)"
          />
        </div>
        <OsmChanges
          :changes="changes"
          @undo="(key) => patch({ [key]: base[key] })"
        />
        <form v-if="changes.length" class="dd-osm-save" @submit.prevent="save">
          <cdx-field>
            <template #label>{{ t("osm-comment") }}</template>
            <template #help-text>{{ t("osm-comment-help") }}</template>
            <cdx-text-input
              v-model="comment"
              :placeholder="defaultComment"
              :disabled="saving"
              enterkeyhint="send"
            />
          </cdx-field>
          <cdx-message v-if="!osmAuth.available" class="dd-osm-save-note">
            {{ t("osm-save-unavailable") }}
          </cdx-message>
          <cdx-field :is-fieldset="true">
            <template #label>{{ t("osm-source") }}</template>
            <ChoiceChips
              :options="sourceOptions"
              :selected="sources"
              @toggle="toggleSource"
            />
          </cdx-field>
        </form>
      </template>
      <template #footer>
        <template v-if="sheet?.kind === 'tag'">
          <cdx-button
            v-if="sheet.key in current"
            action="destructive"
            weight="quiet"
            @click="removeTag(sheet.key)"
          >
            <cdx-icon :icon="cdxIconTrash" />
            {{ t("remove") }}
          </cdx-button>
          <cdx-button
            v-if="tagState(base, current, sheet.key)"
            weight="quiet"
            @click="patch({ [sheet.key]: base[sheet.key] })"
          >
            <cdx-icon :icon="cdxIconUndo" />
            {{ t("undo") }}
          </cdx-button>
        </template>
        <cdx-button
          v-if="sheet?.kind === 'tag' || sheet?.kind === 'pick'"
          action="progressive"
          weight="primary"
          @click="picker?.submit()"
        >
          {{ t("osm-done") }}
        </cdx-button>
        <cdx-button
          v-if="sheet?.kind === 'text'"
          @click="copyTags(parseTagText(text).tags)"
        >
          <cdx-icon :icon="cdxIconCopy" />
          {{ t("osm-copy") }}
        </cdx-button>
        <cdx-button
          v-if="sheet?.kind === 'text'"
          action="progressive"
          weight="primary"
          @click="applyText"
        >
          {{ t("osm-apply") }}
        </cdx-button>
        <template v-if="sheet?.kind === 'review'">
          <cdx-button action="destructive" weight="quiet" @click="discard">
            {{ t("osm-discard") }}
          </cdx-button>
          <cdx-button @click="copyChanges">
            <cdx-icon :icon="cdxIconCopy" />
            {{ t("osm-copy") }}
          </cdx-button>
          <cdx-button
            v-if="osmAuth.username.value"
            action="progressive"
            weight="primary"
            :disabled="saving || !changes.length || !!conflicts.length"
            @click="save"
          >
            <cdx-icon :icon="cdxIconUpload" />
            {{ t("osm-save") }}
          </cdx-button>
          <cdx-button
            v-else-if="osmAuth.available"
            action="progressive"
            weight="primary"
            @click="login"
          >
            <cdx-icon :icon="cdxIconLogIn" />
            {{ t("osm-save-login") }}
          </cdx-button>
        </template>
      </template>
    </BottomSheet>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useEventListener, useTitle } from "@vueuse/core";
import {
  CdxButton,
  CdxField,
  CdxIcon,
  CdxMessage,
  CdxTextInput,
  CdxTextArea,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconCopy,
  cdxIconEdit,
  cdxIconLogIn,
  cdxIconLogoWikidata,
  cdxIconMapPin,
  cdxIconPaste,
  cdxIconTextFlow,
  cdxIconTrash,
  cdxIconUndo,
  cdxIconUpload,
} from "@wikimedia/codex-icons";
import { t, type MessageKey } from "../../i18n";
import { formatRelativeTime } from "../../format";
import { sessionCache } from "../../cache";
import { useSharedClipboard } from "../../clipboard";
import {
  changesetUrl,
  editUrl,
  elementUrl,
  getBounds,
  getElement,
  getParents,
  OsmApiError,
  saveTags,
  type OsmElement,
  type Tags,
} from "../../osm/osm";
import { useOsmAuth } from "../../auth";
import type { Bounds } from "../../osm/geocoding";
import { osmHash, shortRef, type OsmRef } from "../../osm/osm-ref";
import {
  changePresetPatch,
  fieldForKey,
  fieldMatchesKey,
  geometries,
  matchPreset,
  presetFields,
  useSchema,
  type Field,
} from "../../osm/presets";
import { useTagDocs } from "../../osm/osmwiki";
import { useRecent } from "../../osm/recent";
import {
  applyPatch,
  diffTags,
  formatTagText,
  mergeTags,
  parseTagText,
  patchTo,
  tagState,
  type TagChange,
  type TagPatch,
} from "../../osm/tags";
import EntityId from "../EntityId.vue";
import EntitySkeleton from "../EntitySkeleton.vue";
import AddTag from "./AddTag.vue";
import BottomSheet from "./BottomSheet.vue";
import ChoiceChips from "./ChoiceChips.vue";
import FieldEditor from "./FieldEditor.vue";
import OsmChanges from "./OsmChanges.vue";
import OsmIssues from "./OsmIssues.vue";
import { validate } from "../../osm/validate";
import PresetIcon from "./PresetIcon.vue";
import PresetPicker from "./PresetPicker.vue";
import StaticMap from "./StaticMap.vue";
import TagInfo from "./TagInfo.vue";
import TagRow from "./TagRow.vue";
import ValuePicker from "./ValuePicker.vue";

const props = defineProps<{ osmRef: OsmRef; language: string }>();

/** Codex link styled as a button ("fake button") */
const LINK_BUTTON = [
  "cdx-button",
  "cdx-button--fake-button",
  "cdx-button--fake-button--enabled",
];

const element = shallowRef<OsmElement>();
const parents = shallowRef<OsmElement[]>([]);
const bounds = shallowRef<Bounds>();
const loading = ref(false);
const error = ref<string>();
const toast = useToast();

const { schema } = useSchema();
/** tags of the loaded version */
const base = computed<Tags>(() => element.value?.tags ?? {});
/** tags with the pending edits */
const current = ref<Tags>({});
const changes = computed(() => diffTags(base.value, current.value));
const geometry = computed(() =>
  element.value ? geometries({ ...element.value, tags: current.value }) : [],
);

function patch(p: TagPatch) {
  current.value = applyPatch(current.value, p);
}

// pending edits survive reloads and the login popup, for the same version
const editsKey = (e: OsmElement) => `osm-edits:${e.type}/${e.id}`;
watch(current, (tags) => {
  const e = element.value;
  if (!e) return;
  sessionCache.set(
    editsKey(e),
    changes.value.length ? JSON.stringify({ version: e.version, tags }) : "",
  );
});
function restoreEdits(e: OsmElement): Tags {
  try {
    const saved = JSON.parse(sessionCache.get(editsKey(e)) || "null") as {
      version: number;
      tags: Tags;
    } | null;
    if (saved?.version === e.version) return saved.tags;
  } catch {
    // ignore unreadable edits
  }
  return { ...e.tags };
}

const preset = computed(() =>
  schema.value && element.value
    ? matchPreset(schema.value, current.value, geometry.value)
    : undefined,
);

/** fields added via "Add" before they have a value */
const addedFields = ref<string[]>([]);

const allFields = computed(() => {
  if (!schema.value || !preset.value)
    return { fields: [] as Field[], moreFields: [] as Field[] };
  return presetFields(
    schema.value,
    preset.value.id,
    current.value,
    geometry.value,
  );
});

const usedKeys = computed(() => [
  ...new Set([...Object.keys(base.value), ...Object.keys(current.value)]),
]);

/** Fields of the preset, and more fields in use or added. */
const visibleFields = computed(() => {
  const { fields, moreFields } = allFields.value;
  return [
    ...fields,
    ...moreFields.filter(
      (f) =>
        addedFields.value.includes(f.id) ||
        usedKeys.value.some((k) => fieldMatchesKey(f, k)),
    ),
  ].filter((f) => f.type !== "restrictions");
});

/** more fields for "Add", not shown yet */
const addableFields = computed(() =>
  allFields.value.moreFields.filter(
    (f) => f.type !== "restrictions" && !visibleFields.value.includes(f),
  ),
);

/** tags not edited by a visible field */
const otherKeys = computed(() =>
  usedKeys.value
    .filter((k) => !visibleFields.value.some((f) => fieldMatchesKey(f, k)))
    .sort(),
);

function addField(id: string) {
  addedFields.value = [...addedFields.value, id];
  sheet.value = undefined;
}

type Sheet =
  | { kind: "tag" | "info"; key: string }
  | { kind: "pick"; key: string; field: Field; multi: boolean }
  | { kind: "add" | "preset" | "text" | "review" };
const sheet = ref<Sheet>();
const picker = useTemplateRef<InstanceType<typeof ValuePicker>>("picker");

const sheetTitle = computed(() => {
  const s = sheet.value;
  if (!s) return "";
  if (s.kind === "tag" || s.kind === "info") return s.key;
  if (s.kind === "pick") return s.field.label;
  return {
    add: t("osm-add"),
    preset: t("osm-preset-change"),
    text: t("osm-text-view"),
    review: t("osm-changes", changes.value.length),
  }[s.kind];
});

/** field of the schema for the key of the tag sheet, for options */
const sheetField = computed(() => {
  const s = sheet.value;
  return s?.kind === "tag" && schema.value
    ? fieldForKey(schema.value, s.key)
    : undefined;
});

function onPick(value: string | undefined, done: boolean) {
  const s = sheet.value;
  if (s?.kind !== "tag" && s?.kind !== "pick") return;
  if (value !== current.value[s.key]) patch({ [s.key]: value });
  if (done) sheet.value = undefined;
}

function removeTag(key: string) {
  patch({ [key]: undefined });
  sheet.value = undefined;
}

function changePreset(id: string) {
  if (schema.value && preset.value)
    patch(changePresetPatch(schema.value, preset.value.id, id, current.value));
  sheet.value = undefined;
}

// text view
const text = ref("");
function openText() {
  text.value = formatTagText(current.value);
  sheet.value = { kind: "text" };
}
function applyText() {
  const { tags, invalid } = parseTagText(text.value);
  patch(patchTo(current.value, tags));
  sheet.value = undefined;
  if (invalid.length)
    toast.warning(t("osm-text-invalid", invalid.length, invalid.join("; ")), {
      autoDismiss: 8000,
    });
}

// saving
const osmAuth = useOsmAuth();
const SOURCES = ["survey", "local_knowledge", "website", "imagery"];
const sourceOptions = computed(() =>
  SOURCES.map((value) => ({
    value,
    label: t(`osm-source-${value}` as MessageKey),
  })),
);
const comment = ref("");
const sources = ref<string[]>([]);
const saving = ref(false);
/** keys changed meanwhile by someone else and by the user */
const conflicts = ref<TagChange[]>([]);

const defaultComment = computed(() =>
  t("osm-comment-default", preset.value?.name ?? "", title.value),
);

function toggleSource(value: string) {
  sources.value = sources.value.includes(value)
    ? sources.value.filter((v) => v !== value)
    : [...sources.value, value];
}

async function login() {
  try {
    await osmAuth.login();
  } catch (e) {
    if (!String(e).includes("closed"))
      toast.error(t("login-failed", String(e)));
  }
}

const SOURCE_TAGS: Record<string, string> = {
  survey: "survey",
  local_knowledge: "local knowledge",
  website: "website",
  imagery: "aerial imagery",
};

async function save() {
  const e = element.value;
  const token = osmAuth.accessToken.value;
  if (!e || !token || !changes.value.length || conflicts.value.length) return;
  saving.value = true;
  try {
    const { changeset } = await saveTags(
      e,
      current.value,
      {
        comment: comment.value.trim() || defaultComment.value,
        created_by: "DinoData",
        locale: props.language,
        ...(sources.value.length && {
          source: sources.value.map((s) => SOURCE_TAGS[s]).join(";"),
        }),
      },
      token,
    );
    comment.value = "";
    sheet.value = undefined;
    const saved = await getElement(e);
    current.value = { ...saved.tags };
    element.value = saved;
    toast.show({
      type: "success",
      message: t("osm-saved", changeset),
      actionButton: {
        label: t("osm-saved-show"),
        onClick: () => window.open(changesetUrl(changeset), "_blank"),
      },
      autoDismiss: 10000,
    });
  } catch (err) {
    if (err instanceof OsmApiError && err.status === 409) await merge(e);
    else if (err instanceof OsmApiError && err.status === 401) {
      await osmAuth.logout();
      toast.error(t("osm-save-unauthorized"));
    } else
      toast.error(
        t("save-failed", err instanceof Error ? err.message : String(err)),
      );
  } finally {
    saving.value = false;
  }
}

/**
 * Edited meanwhile: merge with the current version; keys changed on both
 * sides are shown to choose, the rest is saved right away.
 */
async function merge(old: OsmElement) {
  const latest = await getElement(old);
  const merged = mergeTags(old.tags ?? {}, current.value, latest.tags ?? {});
  element.value = latest;
  current.value = merged.tags;
  conflicts.value = merged.conflicts;
  if (merged.conflicts.length) {
    sheet.value = { kind: "review" };
    return;
  }
  toast.info(t("osm-merged", latest.user ?? "?"), { autoDismiss: 6000 });
  if (changes.value.length) await save();
}

function conflictOptions(conflict: TagChange) {
  const label = (v?: string) => v ?? t("osm-conflict-none");
  return [
    { value: "theirs", label: t("osm-conflict-theirs", label(conflict.old)) },
    { value: "mine", label: t("osm-conflict-mine", label(conflict.new)) },
  ];
}

function resolveConflict(key: string, choice: string) {
  const conflict = conflicts.value.find((c) => c.key === key);
  if (!conflict) return;
  patch({ [key]: choice === "mine" ? conflict.new : conflict.old });
  conflicts.value = conflicts.value.filter((c) => c.key !== key);
}

function discard() {
  current.value = { ...base.value };
  sheet.value = undefined;
}

// copy & paste as key=value lines
const clipboard = useSharedClipboard();
/** Copy tags, all by default, like the statements of a property. */
async function copyTags(tags: Tags = current.value) {
  await clipboard.copy(formatTagText(tags));
  toast.success(t("osm-copied", Object.keys(tags).length), {
    autoDismiss: true,
  });
}
async function copyChanges() {
  await clipboard.copy(
    changes.value
      .map((c) => (c.new === undefined ? `${c.key}=` : `${c.key}=${c.new}`))
      .join("\n"),
  );
  toast.success(t("osm-copied", changes.value.length), { autoDismiss: true });
}

function pasteTags(textValue: string | undefined) {
  const { tags, invalid } = parseTagText(textValue ?? "");
  const count = Object.keys(tags).length;
  if (!count) {
    toast.warning(t("osm-paste-empty"), { autoDismiss: 8000 });
    return;
  }
  const before = current.value;
  patch(tags);
  toast.show({
    type: invalid.length ? "warning" : "success",
    message: [
      t("osm-pasted", count),
      ...(invalid.length
        ? [t("paste-invalid", invalid.length, invalid.join("; "))]
        : []),
    ].join(" · "),
    actionButton: {
      label: t("undo"),
      onClick: () => (current.value = before),
    },
    autoDismiss: invalid.length ? false : 6000,
  });
}

async function pasteFromButton() {
  try {
    pasteTags(await navigator.clipboard.readText());
  } catch {
    // clipboard read denied: Ctrl+V still works via the paste event
    toast.warning(t("paste-denied"), { autoDismiss: 6000 });
  }
}

// Ctrl+V anywhere on the page, except in inputs and sheets
useEventListener(document, "paste", (event: ClipboardEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable], dialog")) return;
  event.preventDefault();
  pasteTags(event.clipboardData?.getData("text/plain"));
});

/** Fields of the preset, for translated labels of values. */
function optionLabel(key: string, value: string): string | undefined {
  const field =
    allFields.value.moreFields.find((f) => fieldMatchesKey(f, key)) ??
    (schema.value ? fieldForKey(schema.value, key) : undefined);
  return field?.options.find((o) => o.value === value)?.label;
}

const { docs, itemLabels, load: loadDocs } = useTagDocs(() => props.language);
watch([current, () => props.language], () => {
  loadDocs(current.value).catch(console.warn);
});
const issues = computed(() =>
  element.value
    ? validate(
        element.value,
        current.value,
        docs.value,
        itemLabels.value,
        schema.value?.deprecated ?? [],
      )
    : [],
);

const describe = (key: string, value: string) =>
  docs.value[`${key}=${value}`]?.description ?? docs.value[key]?.description;
const isDiscouraged = (key: string, value: string) =>
  !!(
    docs.value[`${key}=${value}`]?.discouraged || docs.value[key]?.discouraged
  );

function presetOf(e: OsmElement) {
  return schema.value
    ? matchPreset(schema.value, e.tags ?? {}, geometries(e))
    : undefined;
}

/** Name in the user language, else name, ref, or the preset. */
function elementTitle(e: OsmElement, tags = e.tags ?? {}): string {
  return (
    tags[`name:${props.language}`] ??
    tags.name ??
    tags.ref ??
    presetOf({ ...e, tags })?.name ??
    `${e.type} ${e.id}`
  );
}

const title = computed(() =>
  element.value ? elementTitle(element.value, current.value) : "",
);

const wikidataId = computed(() =>
  current.value.wikidata?.match(/^Q\d+$/) ? current.value.wikidata : undefined,
);

// remembered for the OSM home page, once the preset is known
const { add: addRecent } = useRecent();
watch(
  () => [element.value, schema.value] as const,
  ([e, s]) => {
    if (!e || !s) return;
    const p = presetOf(e);
    addRecent({
      type: e.type,
      id: e.id,
      name: elementTitle(e),
      icon: p?.icon,
      preset: p?.name,
    });
  },
);

// restores "DinoData" on unmount
useTitle(
  computed(() =>
    [shortRef(props.osmRef), title.value, "DinoData"]
      .filter(Boolean)
      .join(" · "),
  ),
);

watch(
  () => [props.osmRef.type, props.osmRef.id],
  async () => {
    const osmRef = props.osmRef;
    loading.value = true;
    error.value = undefined;
    parents.value = [];
    bounds.value = undefined;
    sheet.value = undefined;
    addedFields.value = [];
    conflicts.value = [];
    try {
      const e = await getElement(osmRef);
      if (props.osmRef !== osmRef) return;
      current.value = restoreEdits(e);
      element.value = e;
      loading.value = false;
      getBounds(e)
        .then((b) => props.osmRef === osmRef && (bounds.value = b))
        .catch(console.warn);
      getParents(osmRef)
        .then((p) => props.osmRef === osmRef && (parents.value = p))
        .catch(console.warn);
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
/* the header is flattened into the article grid, like the entity view */
.dd-osm {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "title title"
    "preset map"
    "meta map"
    "links map";
  grid-template-rows: auto auto auto 1fr;
  column-gap: 2rem;
}
.dd-osm > :not(.dd-osm-header) {
  grid-column: 1 / -1;
  min-width: 0;
}
.dd-osm-header {
  display: contents;
}
.dd-osm h1 {
  grid-area: title;
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0;
  padding: 0.25rem 0;
  background: var(--background-color-base);
  overflow-wrap: anywhere;
}
.dd-osm-preset {
  all: unset;
  grid-area: preset;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2rem;
  font-size: 1.2em;
  cursor: pointer;
}
.dd-osm-preset:hover,
.dd-osm-preset:focus-visible {
  color: var(--color-progressive);
}
.dd-osm-meta {
  grid-area: meta;
  margin: 0 0 0.5rem;
  color: var(--color-subtle);
  font-size: 0.875em;
}
.dd-osm-links {
  grid-area: links;
  align-self: start;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0;
}
.dd-osm-map {
  grid-area: map;
  align-self: start;
  width: 300px;
  margin-top: 0.5rem;
}
.dd-osm h2 {
  font-size: 1.1em;
  margin: 1.5rem 0 0.5rem;
}
.dd-osm-tags {
  margin-top: 1rem;
}
.dd-osm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.dd-osm-box {
  margin-top: 0.75rem;
  border: 1px solid var(--border-color-subtle);
  border-bottom: none;
  border-radius: var(--border-radius-base);
}
.dd-osm-box ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dd-osm .dd-osm-box-heading {
  margin: 0;
  padding: 0.375rem 0.625rem;
  border-bottom: 1px solid var(--border-color-subtle);
  font-size: var(--font-size-small);
  color: var(--color-subtle);
}
.dd-osm-conflict {
  margin: 0.5rem 0 1rem;
}
.dd-osm-conflict code {
  display: block;
  margin-bottom: 0.25rem;
}
.dd-osm-save {
  margin-top: 1rem;
}
.dd-osm-save-note {
  margin-top: 0.75rem;
}
.dd-osm-text {
  font-family: var(--font-family-monospace);
}
.dd-osm-parents {
  margin: 0;
  padding-inline-start: 0;
  list-style: none;
}
.dd-osm-parents li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem 0;
}
.dd-osm-parents a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.dd-osm-subtle {
  color: var(--color-subtle);
  margin-inline-start: 0.25rem;
}
/* sticky action bar, within thumb reach on phones */
.dd-osm-bar {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  margin: 1.5rem -1rem 0;
  padding: 0.625rem 1rem;
  padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
  background: var(--background-color-base);
  border-top: 1px solid var(--border-color-subtle);
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
@media (max-width: 640px) {
  .dd-osm {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-template-areas: "map" "title" "preset" "meta" "links";
  }
  .dd-osm-map {
    width: auto;
  }
}
</style>
