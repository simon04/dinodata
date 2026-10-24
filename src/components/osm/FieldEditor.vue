<template>
  <div class="dd-field" :class="{ 'dd-field--changed': changed }">
    <div class="dd-field-header">
      <span :id="labelId" class="dd-field-label">{{ field.label }}</span>
      <button
        v-if="mainKey"
        type="button"
        class="dd-field-key dd-id-chip"
        :aria-label="t('osm-doc-show', mainKey)"
        @click="emit('info', mainKey)"
      >
        {{ keyHint }}
      </button>
      <span class="dd-field-buttons">
        <cdx-button
          v-if="changed"
          weight="quiet"
          size="small"
          :aria-label="t('undo')"
          v-tooltip="t('undo')"
          @click="undo"
        >
          <cdx-icon :icon="cdxIconUndo" size="small" />
        </cdx-button>
        <cdx-button
          v-if="fieldTagCount"
          class="dd-field-copy"
          weight="quiet"
          size="small"
          :aria-label="t('osm-copy-tags', fieldTagCount)"
          v-tooltip="t('osm-copy-tags', fieldTagCount)"
          @click="copy"
        >
          <cdx-icon :icon="cdxIconCopy" size="small" />
        </cdx-button>
      </span>
    </div>

    <div class="dd-field-value">
      <!-- yes/no and radio fields -->
      <ChoiceChips
        v-if="kind === 'choice'"
        :options="choiceOptions"
        :selected="value ? [value] : []"
        :label="field.label"
        @toggle="(v) => set(mainKey!, v === value ? undefined : v)"
      />

      <!-- diet:vegan=yes, diet:halal=yes, … -->
      <ChoiceChips
        v-else-if="kind === 'prefix'"
        :options="field.options"
        :selected="
          field.options
            .filter((o) => tags[`${field.key}${o.value}`] === 'yes')
            .map((o) => o.value)
        "
        :label="field.label"
        @toggle="togglePrefixed"
      />

      <!-- cuisine=pizza;pasta -->
      <div v-else-if="kind === 'semi'" class="dd-field-chips">
        <span v-for="v in splitValues(value)" :key="v" class="dd-field-chip">
          {{ optionLabel(v) }}
          <button
            type="button"
            :aria-label="t('remove')"
            @click="removeValue(v)"
          >
            <cdx-icon :icon="cdxIconClose" size="x-small" />
          </button>
        </span>
        <cdx-button size="small" @click="emit('pick', mainKey!, true)">
          <cdx-icon :icon="cdxIconAdd" size="small" />
          {{ t("add") }}
        </cdx-button>
      </div>

      <!-- combo: opens the value picker -->
      <button
        v-else-if="kind === 'pick'"
        type="button"
        class="dd-field-select"
        :aria-labelledby="labelId"
        @click="emit('pick', mainKey!, false)"
      >
        <span v-if="value">
          {{ optionLabel(value) }}
          <code v-if="optionLabel(value) !== value">{{ value }}</code>
        </span>
        <span v-else class="dd-field-placeholder">
          {{ field.placeholder ?? t("osm-choose") }}
        </span>
        <cdx-icon :icon="cdxIconExpand" size="small" />
      </button>

      <!-- several keys, e.g. access, foot, bicycle -->
      <div v-else-if="kind === 'keys'" class="dd-field-subkeys">
        <button
          v-for="key in field.keys"
          :key="key"
          type="button"
          class="dd-field-select"
          @click="emit('pick', key, false)"
        >
          <span class="dd-field-subkey">{{ key }}</span>
          <span v-if="tags[key]">{{ optionLabel(tags[key]) }}</span>
          <span v-else class="dd-field-placeholder">{{ t("osm-choose") }}</span>
          <cdx-icon :icon="cdxIconExpand" size="small" />
        </button>
      </div>

      <!-- name, name:de, … -->
      <div v-else-if="kind === 'localized'" class="dd-field-subkeys">
        <cdx-text-input
          :model-value="value ?? ''"
          :placeholder="field.placeholder"
          :aria-labelledby="labelId"
          enterkeyhint="done"
          @change="onChange(mainKey!, $event)"
          @keydown.enter="blur"
        />
        <div
          v-for="key in localizedKeys"
          :key="key"
          class="dd-field-subkey-row"
        >
          <code class="dd-field-subkey">
            {{ key.slice(mainKey!.length + 1) }}
          </code>
          <cdx-text-input
            :model-value="tags[key] ?? ''"
            :aria-label="key"
            enterkeyhint="done"
            @change="onChange(key, $event)"
            @keydown.enter="blur"
          />
        </div>
        <form
          v-if="addingLanguage"
          class="dd-field-subkey-row"
          @submit.prevent="addLanguage"
        >
          <cdx-text-input
            v-model="newLanguage"
            class="dd-field-language"
            :placeholder="t('terms-placeholder-language')"
            :aria-label="t('terms-placeholder-language')"
            autocapitalize="off"
            enterkeyhint="done"
          />
          <cdx-button type="submit">{{ t("add") }}</cdx-button>
        </form>
        <cdx-button
          v-else
          size="small"
          weight="quiet"
          @click="addingLanguage = true"
        >
          <cdx-icon :icon="cdxIconLanguage" size="small" />
          {{ t("osm-add-language") }}
        </cdx-button>
      </div>

      <!-- addr:street, addr:housenumber, … -->
      <div v-else-if="kind === 'address'" class="dd-field-address">
        <label
          v-for="key in addressKeys"
          :key="key"
          :class="`dd-field-address-${key.slice(5)}`"
        >
          <span class="dd-field-subkey">{{ addressLabel(key) }}</span>
          <cdx-text-input
            :model-value="tags[key] ?? ''"
            :inputmode="
              key === 'addr:housenumber' || key === 'addr:postcode'
                ? 'numeric'
                : undefined
            "
            enterkeyhint="next"
            @change="onChange(key, $event)"
          />
        </label>
      </div>

      <!-- wikidata=Q… -->
      <div v-else-if="kind === 'wikidata'" class="dd-field-wikidata">
        <span v-if="value" class="dd-field-wikidata-value">
          <a :href="`#${value}`">{{ wikidataLabel ?? value }}</a>
          <code class="dd-id-chip">{{ value }}</code>
          <cdx-button
            weight="quiet"
            size="small"
            :aria-label="t('remove')"
            @click="set(mainKey!, undefined)"
          >
            <cdx-icon :icon="cdxIconTrash" size="small" />
          </cdx-button>
        </span>
        <EntitySearch
          :language="language"
          :placeholder="t('search-item')"
          @select="(id: string) => set(mainKey!, id)"
        />
      </div>

      <cdx-text-area
        v-else-if="kind === 'textarea'"
        :model-value="value ?? ''"
        :placeholder="field.placeholder"
        :aria-labelledby="labelId"
        autosize
        @change="onChange(mainKey!, $event)"
      />

      <cdx-text-input
        v-else
        :model-value="value ?? ''"
        :input-type="inputType"
        :inputmode="inputMode"
        :placeholder="field.placeholder"
        :aria-labelledby="labelId"
        :start-icon="field.type === 'url' ? cdxIconLink : undefined"
        enterkeyhint="done"
        autocapitalize="off"
        @change="onChange(mainKey!, $event)"
        @keydown.enter="blur"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxTextArea,
  CdxTextInput,
} from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconClose,
  cdxIconCopy,
  cdxIconExpand,
  cdxIconLanguage,
  cdxIconLink,
  cdxIconTrash,
  cdxIconUndo,
} from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import type { Tags } from "../../osm/osm";
import { fieldMatchesKey, humanize, type Field } from "../../osm/presets";
import { joinValues, splitValues, type TagPatch } from "../../osm/tags";
import { getLabels } from "../../wikidata";
import ChoiceChips from "./ChoiceChips.vue";
import EntitySearch from "../EntitySearch.vue";

/** Editor of one preset field, with the input matching its type. */
const props = defineProps<{
  field: Field;
  tags: Tags;
  base: Tags;
  language: string;
}>();
const emit = defineEmits<{
  patch: [patch: TagPatch];
  /** open the value picker for the key */
  pick: [key: string, multi: boolean];
  /** show the documentation of the key */
  info: [key: string];
  /** copy the tags of the field */
  copy: [tags: Tags];
}>();

const labelId = useId();

/** the key edited: an alternative key in use (contact:phone), else the key */
const mainKey = computed(
  () =>
    props.field.keys.find((k) => k in props.tags) ??
    props.field.key ??
    props.field.keys[0],
);
const value = computed(() =>
  mainKey.value ? props.tags[mainKey.value] : undefined,
);

const keyHint = computed(() => {
  const key = mainKey.value ?? "";
  if (props.field.type === "multiCombo") return `${key}*`;
  if (props.field.type === "address") return "addr:*";
  return key;
});

const CHOICE = ["check", "defaultCheck", "onewayCheck", "radio"];
const PICK = [
  "combo",
  "typeCombo",
  "networkCombo",
  "manyCombo",
  "directionalCombo",
];

const kind = computed(() => {
  const { type, options, customValues, keys } = props.field;
  if (CHOICE.includes(type)) return "choice";
  if (type === "multiCombo") return "prefix";
  if (type === "semiCombo") return "semi";
  if (type === "access" || type === "structureRadio")
    return keys.length > 1 ? "keys" : "pick";
  if (PICK.includes(type)) {
    if (!customValues && options.length <= 6) return "choice";
    // free values without options, e.g. opening_hours: typed
    return options.length ? "pick" : "text";
  }
  if (type === "localized") return "localized";
  if (type === "address") return "address";
  if (type === "wikidata") return "wikidata";
  if (type === "textarea") return "textarea";
  return "text";
});

/** options plus the current value if it is not one of them */
const choiceOptions = computed(() => {
  const options = props.field.options;
  const v = value.value;
  return v && !options.some((o) => o.value === v)
    ? [...options, { value: v, label: v }]
    : options;
});

const inputType = computed(() => {
  const type = props.field.type;
  if (type === "tel" || type === "email" || type === "url") return type;
  return "text";
});
/** numbers may have units (50 mph), so no number input, but its keyboard */
const inputMode = computed(() =>
  ["number", "roadspeed", "roadheight"].includes(props.field.type)
    ? "decimal"
    : undefined,
);

const changed = computed(() =>
  Object.keys({ ...props.tags, ...props.base }).some(
    (k) => fieldMatchesKey(props.field, k) && props.tags[k] !== props.base[k],
  ),
);

function set(key: string, v: string | undefined) {
  emit("patch", { [key]: v });
}

function onChange(key: string, event: Event) {
  const v = (event.target as HTMLInputElement).value;
  if ((props.tags[key] ?? "") !== v) set(key, v);
}

function blur(event: KeyboardEvent) {
  (event.target as HTMLElement).blur();
}

/** tags edited by this field */
const fieldTags = computed(() =>
  Object.fromEntries(
    Object.entries(props.tags).filter(([k]) => fieldMatchesKey(props.field, k)),
  ),
);
const fieldTagCount = computed(() => Object.keys(fieldTags.value).length);
function copy() {
  emit("copy", fieldTags.value);
}

function undo() {
  const patch: TagPatch = {};
  for (const k of Object.keys({ ...props.tags, ...props.base }))
    if (fieldMatchesKey(props.field, k)) patch[k] = props.base[k];
  emit("patch", patch);
}

function optionLabel(v: string): string {
  return props.field.options.find((o) => o.value === v)?.label ?? v;
}

function removeValue(v: string) {
  set(
    mainKey.value!,
    joinValues(splitValues(value.value).filter((x) => x !== v)),
  );
}

function togglePrefixed(option: string) {
  const key = `${props.field.key}${option}`;
  set(key, props.tags[key] === "yes" ? undefined : "yes");
}

// localized names: name:de, …
const localizedKeys = computed(() =>
  Object.keys(props.tags)
    .filter((k) => k !== mainKey.value && fieldMatchesKey(props.field, k))
    .sort(),
);
const addingLanguage = ref(false);
const newLanguage = ref("");
function addLanguage() {
  const code = newLanguage.value.trim().toLowerCase();
  addingLanguage.value = false;
  newLanguage.value = "";
  if (!code || !mainKey.value) return;
  const key = `${mainKey.value}:${code}`;
  // the value is filled in afterwards; the main name is a good start
  if (!(key in props.tags)) set(key, value.value ?? code);
}

// address: the usual parts, and all others in use
const ADDRESS = [
  "addr:housenumber",
  "addr:street",
  "addr:postcode",
  "addr:city",
];
const addressKeys = computed(() => [
  ...ADDRESS,
  ...Object.keys(props.tags)
    .filter((k) => k.startsWith("addr:") && !ADDRESS.includes(k))
    .sort(),
]);
function addressLabel(key: string): string {
  const part = key.slice(5);
  const { labels, placeholders } = props.field;
  return labels?.[part] ?? placeholders?.[part] ?? humanize(part);
}

// label of the Wikidata item
const wikidataLabel = ref<string>();
watch(
  () => (kind.value === "wikidata" ? value.value : undefined),
  (id) => {
    wikidataLabel.value = undefined;
    if (id && /^Q\d+$/.test(id))
      getLabels([id], props.language, (labels) => {
        if (value.value === id) wikidataLabel.value = labels[id];
      }).catch(console.warn);
  },
  { immediate: true },
);
</script>

<style scoped>
/* like a statement group: label column, then the editor */
.dd-field {
  display: grid;
  grid-template-columns: clamp(12rem, 28%, 20rem) 1fr;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-field-header {
  display: flex;
  align-items: flex-start;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 0 0.25rem;
  padding: 0.375rem 0.625rem;
  background: var(--background-color-neutral-subtle);
  line-height: 1.3;
}
.dd-field-label {
  font-weight: 600;
}
/* together at the end of the first line, like the property buttons */
.dd-field-buttons {
  display: flex;
  margin-inline-start: auto;
}
.dd-field-buttons .cdx-button {
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0;
}
@media (hover: hover) {
  .dd-field-copy {
    opacity: 0.5;
  }
}
.dd-field:hover .dd-field-copy,
.dd-field-copy:focus-visible {
  opacity: 1;
}
.dd-field-value {
  min-width: 0;
  padding: 0.375rem 0.625rem;
}
.dd-field--changed .dd-field-value {
  background: var(--background-color-warning-subtle);
}
.dd-field-key {
  cursor: help;
}
.dd-field-key:hover,
.dd-field-key:focus-visible {
  color: var(--color-progressive);
}
/* quiet inputs: an underline until hovered or focused */
.dd-field-value :deep(.cdx-text-input__input:not(:hover, :focus)),
.dd-field-value :deep(.cdx-text-area__textarea:not(:hover, :focus)),
.dd-field-select:not(:hover, :focus-visible) {
  border-color: transparent transparent var(--border-color-subtle);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.dd-field-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}
.dd-field-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2rem;
  padding-inline: 0.75rem 0.25rem;
  border-radius: 1rem;
  background: var(--background-color-progressive-subtle);
  color: var(--color-progressive);
}
.dd-field-chip button {
  all: unset;
  display: inline-flex;
  padding: 0.375rem;
  border-radius: 50%;
  cursor: pointer;
}
.dd-field-chip button:hover,
.dd-field-chip button:focus-visible {
  background: var(--background-color-interactive);
}
.dd-field-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2rem;
  padding: 0 0.5rem;
  box-sizing: border-box;
  border: 1px solid var(--border-color-base);
  border-radius: var(--border-radius-base);
  background: var(--background-color-base);
  color: var(--color-base);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.dd-field-select > :first-child:not(.dd-field-subkey),
.dd-field-select > .dd-field-subkey + span {
  flex: 1;
}
.dd-field-select code {
  margin-inline-start: 0.35rem;
  color: var(--color-subtle);
}
.dd-field-select:hover {
  border-color: var(--border-color-interactive);
}
.dd-field-select:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
}
.dd-field-placeholder {
  color: var(--color-placeholder);
}
.dd-field-subkeys {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
}
.dd-field-subkeys > .cdx-text-input,
.dd-field-subkeys > .dd-field-select {
  width: 100%;
}
.dd-field-subkey-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.dd-field-subkey-row .cdx-text-input {
  flex: 1;
}
.dd-field-subkey {
  min-width: 2.5rem;
  color: var(--color-subtle);
  font-size: 0.875em;
}
.dd-field-language {
  max-width: 12rem;
}
.dd-field-address {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.375rem 0.5rem;
}
.dd-field-address label {
  display: flex;
  flex-direction: column;
}
.dd-field-address-street,
.dd-field-address-city {
  grid-column: span 1;
}
.dd-field-wikidata {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.dd-field-wikidata-value {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.cdx-text-input,
.cdx-text-area {
  min-width: 0;
}
@media (max-width: 640px) {
  .dd-field {
    grid-template-columns: 1fr;
  }
}
</style>
