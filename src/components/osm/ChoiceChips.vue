<template>
  <div class="dd-choices" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="dd-choice"
      :aria-pressed="selected.includes(option.value)"
      :title="option.description"
      @click="emit('toggle', option.value)"
    >
      <cdx-icon
        v-if="selected.includes(option.value)"
        :icon="cdxIconCheck"
        size="small"
      />
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { CdxIcon } from "@wikimedia/codex";
import { cdxIconCheck } from "@wikimedia/codex-icons";
import type { FieldOption } from "../../osm/presets";

/**
 * Large toggle chips for few options (yes/no, radio fields); tapping the
 * selected chip again clears it.
 */
defineProps<{ options: FieldOption[]; selected: string[]; label?: string }>();
const emit = defineEmits<{ toggle: [value: string] }>();
</script>

<style scoped>
.dd-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.dd-choice {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2.25rem;
  padding: 0 0.875rem;
  border: 1px solid var(--border-color-base);
  border-radius: 1.125rem;
  background: var(--background-color-base);
  color: var(--color-base);
  font: inherit;
  cursor: pointer;
}
.dd-choice:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-choice:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
  outline-offset: 1px;
}
.dd-choice[aria-pressed="true"] {
  border-color: var(--border-color-progressive);
  background: var(--background-color-progressive-subtle);
  color: var(--color-progressive);
  font-weight: bold;
}
</style>
