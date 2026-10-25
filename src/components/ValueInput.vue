<template>
  <EntitySearch
    v-if="entityType"
    ref="input"
    :language="language"
    :type="entityType"
    :placeholder="
      entityType === 'item' ? t('search-item') : t('search-property')
    "
    @select="onEntity"
    @keydown.esc.capture="onEscape"
  />
  <cdx-field
    v-else
    class="dd-value-input"
    :status="showError ? 'error' : waitingForUnits ? 'warning' : 'default'"
    :messages="{
      warning: t('value-units-loading'),
      error: unitMatches.length
        ? t('value-unit-choose')
        : t('value-invalid', placeholder),
    }"
    :hide-label="true"
    @keydown.esc.capture="onEscape"
  >
    <template #label>{{ label ?? t("value-placeholder") }}</template>
    <div class="dd-value-row">
      <!-- Enter submits once the unit is clear, else the menu takes it -->
      <span v-if="datatype === 'quantity'" @keydown.enter="submit">
        <cdx-lookup
          ref="input"
          v-model:input-value="text"
          :selected="null"
          :menu-items="unitMenuItems"
          :menu-config="{ visibleItemLimit: 8 }"
          :placeholder="placeholder"
          :status="showError ? 'error' : 'default'"
          :aria-label="label ?? t('value-placeholder')"
          @update:selected="onUnit"
          @blur="touched = true"
        >
          <template #menu-item="{ menuItem }">
            <span class="cdx-menu-item__content">
              <span class="cdx-menu-item__text">
                <span class="cdx-menu-item__text__label">
                  <bdi>{{ menuItem.label }}</bdi>
                </span>
                <code class="dd-id-chip">{{ menuItem.value }}</code>
                <span class="cdx-menu-item__text__description">
                  <bdi>{{ menuItem.description }}</bdi>
                </span>
              </span>
            </span>
          </template>
        </cdx-lookup>
      </span>
      <cdx-text-input
        v-else
        ref="input"
        v-model="text"
        :placeholder="placeholder"
        :status="showError ? 'error' : 'default'"
        @keydown.enter="submit"
        @blur="touched = true"
      />
      <cdx-text-input
        v-if="datatype === 'monolingualtext'"
        v-model="textLanguage"
        class="dd-lang"
        :aria-label="t('value-language-code')"
        @keydown.enter="submit"
      />
      <cdx-button action="progressive" :disabled="empty" @click="submit">
        {{ original ? t("save") : t("add") }}
      </cdx-button>
    </div>
  </cdx-field>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import {
  CdxButton,
  CdxField,
  CdxLookup,
  CdxTextInput,
  type MenuItemData,
} from "@wikimedia/codex";
import type { Snak } from "../wikidata";
import EntitySearch from "./EntitySearch.vue";
import { formatInput, keepOriginal, parseValue } from "../values";
import {
  loadUnits,
  matchesExactly,
  matchUnits,
  resolveUnit,
  splitQuantity,
  unitLabel,
  unitSymbol,
  useUnits,
  type Unit,
} from "../units";

const props = defineProps<{
  property: string;
  datatype: string;
  language: string;
  /** value being edited: prefills the input, see {@link keepOriginal} */
  original?: Snak;
  /** accessible label, e.g. the property label */
  label?: string;
}>();
const emit = defineEmits<{
  submit: [snak: Snak, label?: string];
  cancel: [];
}>();

/**
 * Escape cancels, unless it closes an open suggestion menu. Captured, as
 * Codex menus stop the propagation of Escape even when collapsed.
 */
function onEscape(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (target.getAttribute("aria-expanded") === "true") return;
  emit("cancel");
}

const text = ref(formatInput(props.original?.datavalue));
const textLanguage = ref(
  (props.original?.datavalue?.value as { language?: string })?.language ??
    props.language,
);
const input = useTemplateRef<{ $el: HTMLElement }>("input");

const entityType = computed(() =>
  props.datatype === "wikibase-item"
    ? "item"
    : props.datatype === "wikibase-property"
      ? "property"
      : undefined,
);

const placeholder = computed(() => {
  switch (props.datatype) {
    case "time":
      return t("value-placeholder-time");
    case "quantity":
      return t("value-placeholder-quantity");
    case "globe-coordinate":
      return t("value-placeholder-coordinate");
    case "url":
      return t("value-placeholder-url");
    case "commonsMedia":
      return t("value-placeholder-commons");
  }
  return t("value-placeholder");
});

/*
 * Quantities take the unit after the number, e.g. "1.85 m" or "185 cm",
 * matched against the units of the allowed units constraints (loaded when
 * the first quantity is edited), or QuickStatements "185U174728".
 */
const { units, loading: loadingUnits } = useUnits();
if (props.datatype === "quantity") void loadUnits(props.language);
/** unit picked from the menu, to tell apart units with the same symbol */
const chosenUnit = ref<string>();
const originalUnit = (
  props.original?.datavalue?.value as { unit?: string } | undefined
)?.unit?.match(/Q\d+$/)?.[0];

const quantity = computed(() =>
  props.datatype === "quantity" ? splitQuantity(text.value) : undefined,
);
/** the text after the number, unless QuickStatements syntax */
const unitText = computed(() => {
  const unit = quantity.value?.unit ?? "";
  return /^U\d+$/.test(unit) ? "" : unit;
});
const unitMatches = computed(() =>
  units.value && unitText.value
    ? matchUnits(unitText.value, units.value, props.property)
    : [],
);
/** the unit meant by the text: as picked from the menu, or unambiguous */
const unit = computed<Unit | undefined>(() => {
  const chosen = chosenUnit.value && units.value?.units.get(chosenUnit.value);
  if (chosen && matchesExactly(chosen, unitText.value)) return chosen;
  return resolveUnit(unitMatches.value);
});

/**
 * Units to pick from: matching the text, or the allowed units after a bare
 * number when adding. Empty once the unit is clear, so Enter submits.
 */
const unitMenuItems = computed<MenuItemData[]>(() => {
  const q = quantity.value;
  if (!q || !units.value || unit.value) return [];
  const list = unitText.value
    ? unitMatches.value.map((m) => m.unit)
    : q.unit || originalUnit
      ? []
      : (units.value.allowed.get(props.property) ?? []).flatMap(
          (id) => units.value?.units.get(id) ?? [],
        );
  return list.map((u) => ({
    value: u.id,
    label: `${q.amount} ${unitSymbol(u, props.language)}`,
    description: unitLabel(u, props.language),
  }));
});

function onUnit(id: string | number | null) {
  const item = unitMenuItems.value.find((i) => i.value === id);
  if (!item) return;
  chosenUnit.value = String(id);
  text.value = String(item.label);
}

// editing: show the unit after the number once the units are loaded
watch(
  units,
  (data) => {
    const u = originalUnit && data?.units.get(originalUnit);
    if (!u || text.value !== formatInput(props.original?.datavalue)) return;
    text.value = `${text.value} ${unitSymbol(u, props.language)}`;
    chosenUnit.value = u.id;
  },
  { immediate: true },
);

function datavalue(): Snak["datavalue"] {
  if (props.datatype === "monolingualtext" && !textLanguage.value) return;
  if (quantity.value && unitText.value) {
    if (!unit.value) return;
    const input = `${quantity.value.amount}U${unit.value.id.slice(1)}`;
    return keepOriginal(
      parseValue("quantity", input),
      props.original?.datavalue,
      input,
    );
  }
  return keepOriginal(
    parseValue(props.datatype, text.value, textLanguage.value),
    props.original?.datavalue,
    text.value,
  );
}

const snak = computed<Snak | undefined>(() => {
  const dv = datavalue();
  return dv
    ? {
        snaktype: "value",
        property: props.property,
        datatype: props.datatype,
        datavalue: dv,
      }
    : undefined;
});

const empty = computed(() => !text.value.trim());
/** Validate on blur and on submit, not while typing; empty is not an error. */
const touched = ref(false);
/** a unit is typed, but the units are still loading (once a day) */
const waitingForUnits = computed(
  () => !!unitText.value && !units.value && loadingUnits.value,
);
const showError = computed(
  () => touched.value && !empty.value && !snak.value && !waitingForUnits.value,
);

function submit() {
  if (empty.value) return;
  touched.value = true;
  if (!snak.value) return;
  touched.value = false;
  emit("submit", snak.value);
  text.value = "";
  chosenUnit.value = undefined;
}

function onEntity(id: string, label: string) {
  emit(
    "submit",
    {
      snaktype: "value",
      property: props.property,
      datatype: props.datatype,
      datavalue: {
        type: "wikibase-entityid",
        value: { "entity-type": entityType.value, id },
      },
    },
    label,
  );
}

function focus() {
  input.value?.$el.querySelector("input")?.focus();
}

onMounted(focus);
defineExpose({ focus });
</script>

<style scoped>
/*
 * Codex spaces fields below preceding siblings, here it sits in a row
 * (more specific than Codex's bidi "[dir] .cdx-field")
 */
.dd-value-input.cdx-field {
  margin-top: 0;
}
.dd-value-row {
  display: flex;
  gap: 0.5rem;
}
.dd-value-row > :first-child {
  flex: 1;
}

.dd-lang {
  width: 5rem;
  min-width: 5rem;
}
</style>
