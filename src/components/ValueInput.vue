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
  />
  <div v-else class="dd-value-input">
    <cdx-text-input
      ref="input"
      v-model="text"
      :placeholder="placeholder"
      :status="text && !snak ? 'error' : 'default'"
      @keydown.enter="submit"
    />
    <cdx-text-input
      v-if="datatype === 'monolingualtext'"
      v-model="textLanguage"
      class="dd-lang"
      :aria-label="t('value-language-code')"
      @keydown.enter="submit"
    />
    <cdx-button
      action="progressive"
      weight="primary"
      :disabled="!snak"
      @click="submit"
    >
      {{ t("add") }}
    </cdx-button>
  </div>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { CdxButton, CdxTextInput } from "@wikimedia/codex";
import type { Snak } from "../wikidata";
import EntitySearch from "./EntitySearch.vue";

const props = defineProps<{
  property: string;
  datatype: string;
  language: string;
}>();
const emit = defineEmits<{ submit: [snak: Snak, label?: string] }>();

const text = ref("");
const textLanguage = ref(props.language);
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

function datavalue(): Snak["datavalue"] {
  const v = text.value.trim();
  if (!v) return undefined;
  switch (props.datatype) {
    case "time": {
      const m = v.match(/^(-?)(\d{1,4})(?:-(\d\d))?(?:-(\d\d))?$/);
      if (!m) return undefined;
      const [, sign, year, month, day] = m;
      return {
        type: "time",
        value: {
          time: `${sign || "+"}${year.padStart(4, "0")}-${month ?? "00"}-${day ?? "00"}T00:00:00Z`,
          precision: day ? 11 : month ? 10 : 9,
          timezone: 0,
          before: 0,
          after: 0,
          calendarmodel: "http://www.wikidata.org/entity/Q1985727",
        },
      };
    }
    case "quantity": {
      if (!/^-?\d+(\.\d+)?$/.test(v)) return undefined;
      const amount = v.startsWith("-") ? v : `+${v}`;
      return { type: "quantity", value: { amount, unit: "1" } };
    }
    case "globe-coordinate": {
      const m = v.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) return undefined;
      return {
        type: "globecoordinate",
        value: {
          latitude: Number(m[1]),
          longitude: Number(m[2]),
          precision: 0.0001,
          globe: "http://www.wikidata.org/entity/Q2",
        },
      };
    }
    case "monolingualtext":
      return textLanguage.value
        ? {
            type: "monolingualtext",
            value: { text: v, language: textLanguage.value },
          }
        : undefined;
    case "url":
      return /^\w+:\/\/./.test(v) ? { type: "string", value: v } : undefined;
  }
  return { type: "string", value: v };
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

function submit() {
  if (!snak.value) return;
  emit("submit", snak.value);
  text.value = "";
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
.dd-value-input {
  display: flex;
  gap: 0.5rem;
}
.dd-value-input > :first-child {
  flex: 1;
}
.dd-lang {
  width: 5rem;
  min-width: 5rem;
}
</style>
