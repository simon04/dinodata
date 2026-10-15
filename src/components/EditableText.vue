<template>
  <cdx-text-input
    v-if="editing"
    ref="input"
    v-model="draft"
    class="dd-editable-input"
    :aria-label="placeholder ?? t('edit')"
    :placeholder="placeholder"
    @keydown.enter="commit"
    @keydown.esc="editing = false"
    @blur="commit"
  />
  <button
    v-else
    class="dd-editable"
    :class="{ 'dd-editable-empty': !modelValue }"
    :title="t('edit')"
    @click="start"
  >
    <slot>{{ modelValue || "—" }}</slot>
  </button>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";
import { CdxTextInput } from "@wikimedia/codex";
import { t } from "../i18n";

const props = defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const editing = ref(false);
const draft = ref("");
const input = useTemplateRef<{ $el: HTMLElement }>("input");

async function start() {
  draft.value = props.modelValue;
  editing.value = true;
  await nextTick();
  input.value?.$el.querySelector("input")?.focus();
}

function commit() {
  if (!editing.value) return;
  editing.value = false;
  const value = draft.value.trim();
  if (value !== props.modelValue) emit("update:modelValue", value);
}
</script>

<style scoped>
.dd-editable {
  all: unset;
  display: block;
  width: 100%;
  min-height: 1.4em;
  cursor: text;
  border-radius: var(--border-radius-base);
  overflow-wrap: anywhere;
}
.dd-editable:hover,
.dd-editable:focus-visible {
  outline: 1px dashed var(--border-color-progressive);
  outline-offset: 2px;
}
.dd-editable-empty {
  color: var(--color-placeholder);
}
.dd-editable-input {
  min-width: 0;
}
</style>
