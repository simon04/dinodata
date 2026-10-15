<template>
  <div class="dd-add-statement">
    <PropertyLookup
      v-if="!fixedProperty"
      ref="propertyLookup"
      :language="language"
      autofocus
      @select="property = $event"
    />
    <ValueInput
      v-if="current"
      :key="current.id"
      :property="current.id"
      :datatype="current.datatype"
      :language="language"
      @submit="onSubmit"
    />
    <cdx-button
      weight="quiet"
      aria-label="Cancel"
      @click="emit('close')"
      @keydown.esc="emit('close')"
    >
      <cdx-icon :icon="cdxIconClose" />
    </cdx-button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import { cdxIconClose } from "@wikimedia/codex-icons";
import type { Property } from "../properties";
import type { Snak } from "../wikidata";
import PropertyLookup from "./PropertyLookup.vue";
import ValueInput from "./ValueInput.vue";

const props = defineProps<{ language: string; fixedProperty?: Property }>();
const emit = defineEmits<{
  add: [snak: Snak, label?: string];
  close: [];
}>();

const property = ref<Property>();
const current = computed(() => props.fixedProperty ?? property.value);
const propertyLookup = useTemplateRef<{ reset(): void }>("propertyLookup");

function onSubmit(snak: Snak, label?: string) {
  emit("add", snak, label);
  if (!props.fixedProperty) {
    // ready for the next statement
    property.value = undefined;
    propertyLookup.value?.reset();
  }
}
</script>

<style scoped>
.dd-add-statement {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) 3fr auto;
  gap: 0.5rem;
  align-items: start;
  padding: 0.75rem;
  border: 2px dashed var(--border-color-progressive);
  border-radius: var(--border-radius-base);
  margin-bottom: 0.75rem;
}
.dd-add-statement:has(> :nth-child(2):last-child) {
  grid-template-columns: 1fr auto;
}
@media (max-width: 640px) {
  .dd-add-statement {
    grid-template-columns: 1fr;
  }
}
</style>
