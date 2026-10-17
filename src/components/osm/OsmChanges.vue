<template>
  <ul class="dd-osm-changes">
    <li
      v-for="change in changes"
      :key="change.key"
      :class="
        change.old === undefined
          ? 'dd-change--added'
          : change.new === undefined
            ? 'dd-change--removed'
            : 'dd-change--changed'
      "
    >
      <span class="dd-change-text">
        <code class="dd-change-key">{{ change.key }}</code>
        <span>
          <del v-if="change.old !== undefined">{{ change.old }}</del>
          <span v-if="change.old !== undefined && change.new !== undefined">
            →
          </span>
          <ins v-if="change.new !== undefined">{{ change.new }}</ins>
        </span>
      </span>
      <cdx-button
        weight="quiet"
        :aria-label="t('undo')"
        v-tooltip="t('undo')"
        @click="emit('undo', change.key)"
      >
        <cdx-icon :icon="cdxIconUndo" />
      </cdx-button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import { cdxIconUndo } from "@wikimedia/codex-icons";
import { t } from "../../i18n";
import type { TagChange } from "../../osm/tags";

/** Pending tag changes: old → new, undoable one by one. */
defineProps<{ changes: TagChange[] }>();
const emit = defineEmits<{ undo: [key: string] }>();
</script>

<style scoped>
.dd-osm-changes {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dd-osm-changes li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--border-radius-base);
}
.dd-osm-changes li + li {
  margin-top: 0.25rem;
}
.dd-change-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}
.dd-change-key {
  align-self: flex-start;
  color: var(--color-subtle);
}
.dd-change--added {
  background: var(--background-color-success-subtle);
}
.dd-change--changed {
  background: var(--background-color-warning-subtle);
}
.dd-change--removed {
  background: var(--background-color-error-subtle);
}
del {
  color: var(--color-subtle);
}
ins {
  text-decoration: none;
  font-weight: bold;
}
</style>
