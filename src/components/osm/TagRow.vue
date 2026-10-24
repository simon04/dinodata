<template>
  <li class="dd-tag-row" :class="state && `dd-tag-row--${state}`">
    <span class="dd-tag-row-key">
      <span class="dd-tag-row-key-text">
        {{ tagKey }}
        <cdx-icon
          v-if="discouraged"
          class="dd-tag-row-warning"
          :icon="cdxIconAlert"
          size="small"
          :aria-label="t('osm-doc-discouraged')"
        />
      </span>
      <cdx-button
        class="dd-tag-row-copy"
        weight="quiet"
        size="small"
        :aria-label="t('osm-copy-tags', 1)"
        v-tooltip="t('osm-copy-tags', 1)"
        @click="emit('copy')"
      >
        <cdx-icon :icon="cdxIconCopy" size="small" />
      </cdx-button>
    </span>
    <button class="dd-tag-row-button" @click="emit('open')">
      <span class="dd-tag-row-text">
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
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import { cdxIconAlert, cdxIconCopy, cdxIconNext } from "@wikimedia/codex-icons";
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
const emit = defineEmits<{ open: []; copy: [] }>();
</script>

<style scoped>
/* like a statement group: key column, then the value */
.dd-tag-row {
  display: grid;
  grid-template-columns: clamp(12rem, 28%, 20rem) 1fr;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-tag-row-button {
  all: unset;
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  cursor: pointer;
}
.dd-tag-row-button:hover {
  background: var(--background-color-interactive-subtle);
}
.dd-tag-row-button:focus-visible {
  outline: 2px solid var(--outline-color-progressive--focus, #36c);
  outline-offset: -2px;
}
.dd-tag-row-key {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: var(--background-color-neutral-subtle);
  font-family: var(--font-family-monospace);
  font-size: var(--font-size-small);
  line-height: 1.6;
}
.dd-tag-row-key-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.dd-tag-row-copy {
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0;
}
@media (hover: hover) {
  .dd-tag-row-copy {
    opacity: 0.5;
  }
}
.dd-tag-row:hover .dd-tag-row-copy,
.dd-tag-row-copy:focus-visible {
  opacity: 1;
}
.dd-tag-row-warning {
  color: var(--color-warning);
}
.dd-tag-row-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.375rem 0.625rem;
  line-height: 1.4;
}
.dd-tag-row-value {
  overflow-wrap: anywhere;
}
.dd-tag-row-value code {
  margin-inline-start: 0.25rem;
  color: var(--color-subtle);
}
.dd-tag-row-description {
  color: var(--color-subtle);
  font-size: 0.8125em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.dd-tag-row-chevron {
  align-self: stretch;
  padding-inline: 0.5rem;
  color: var(--color-subtle);
}
/* reveal on hover; always visible on touch devices */
@media (hover: hover) {
  .dd-tag-row-chevron {
    opacity: 0;
  }
  .dd-tag-row-button:hover .dd-tag-row-chevron,
  .dd-tag-row-button:focus-visible .dd-tag-row-chevron {
    opacity: 1;
  }
}
[dir="rtl"] .dd-tag-row-chevron {
  transform: scaleX(-1);
}
.dd-tag-row--added .dd-tag-row-button {
  background: var(--background-color-success-subtle);
}
.dd-tag-row--changed .dd-tag-row-button {
  background: var(--background-color-warning-subtle);
}
.dd-tag-row--removed .dd-tag-row-button {
  background: var(--background-color-error-subtle);
}
.dd-tag-row--removed .dd-tag-row-value {
  text-decoration: line-through;
}
@media (max-width: 640px) {
  .dd-tag-row {
    grid-template-columns: 1fr;
  }
}
</style>
