<template>
  <li class="dd-tag-row" :class="state && `dd-tag-row--${state}`">
    <button class="dd-tag-row-button" @click="emit('open')">
      <span class="dd-tag-row-text">
        <span class="dd-tag-row-key">
          {{ tagKey }}
          <cdx-icon
            v-if="discouraged"
            class="dd-tag-row-warning"
            :icon="cdxIconAlert"
            size="small"
            :aria-label="t('osm-doc-discouraged')"
          />
        </span>
        <span class="dd-tag-row-value">
          <template v-if="valueLabel && valueLabel !== value">
            {{ valueLabel }}
            <code>{{ value }}</code>
          </template>
          <template v-else>{{ value }}</template>
        </span>
        <span v-if="description" class="dd-tag-row-description">
          {{ description }}
        </span>
      </span>
      <cdx-icon class="dd-tag-row-chevron" :icon="cdxIconNext" size="small" />
    </button>
  </li>
</template>

<script setup lang="ts">
import { CdxIcon } from "@wikimedia/codex";
import { cdxIconAlert, cdxIconNext } from "@wikimedia/codex-icons";
import { t } from "../../i18n";

/** One tag as a large, tappable row: key, value and its meaning. */
defineProps<{
  tagKey: string;
  value: string;
  /** translated option of the preset field, e.g. "Asphalt" */
  valueLabel?: string;
  description?: string;
  discouraged?: boolean;
  state?: "added" | "changed" | "removed";
}>();
const emit = defineEmits<{ open: [] }>();
</script>

<style scoped>
.dd-tag-row + .dd-tag-row {
  border-top: 1px solid var(--border-color-subtle);
}
.dd-tag-row-button {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}
.dd-tag-row-button:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-tag-row-button:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
  outline-offset: -2px;
}
.dd-tag-row-text {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) 1fr;
  gap: 0 1rem;
  min-width: 0;
}
.dd-tag-row-key {
  font-family: var(--font-family-monospace);
  font-size: var(--font-size-small);
  color: var(--color-subtle);
  overflow-wrap: anywhere;
}
.dd-tag-row-warning {
  color: var(--color-warning);
}
.dd-tag-row-value {
  overflow-wrap: anywhere;
}
.dd-tag-row-value code {
  margin-inline-start: 0.25rem;
  color: var(--color-subtle);
}
.dd-tag-row-description {
  grid-column: 2;
  color: var(--color-subtle);
  font-size: 0.8125em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.dd-tag-row-chevron {
  color: var(--color-subtle);
}
[dir="rtl"] .dd-tag-row-chevron {
  transform: scaleX(-1);
}
.dd-tag-row--added {
  background: var(--background-color-success-subtle);
}
.dd-tag-row--changed {
  background: var(--background-color-warning-subtle);
}
.dd-tag-row--removed {
  background: var(--background-color-error-subtle);
}
.dd-tag-row--removed .dd-tag-row-value {
  text-decoration: line-through;
}
@media (max-width: 640px) {
  .dd-tag-row-text {
    grid-template-columns: 1fr;
  }
  .dd-tag-row-description {
    grid-column: 1;
  }
}
</style>
