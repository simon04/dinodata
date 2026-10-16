<template>
  <button
    class="dd-entity-id"
    v-tooltip="t('copy-id', id)"
    :aria-label="t('copy-id', id)"
    @click.prevent="copyId"
  >
    <code>{{ id }}</code>
  </button>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { useToast } from "@wikimedia/codex";
import { useSharedClipboard } from "../clipboard";

const props = defineProps<{ id: string }>();
const toast = useToast();
const clipboard = useSharedClipboard();

async function copyId() {
  await clipboard.copy(props.id);
  toast.success(t("copied-id", props.id), { autoDismiss: true });
}
</script>

<style>
/* Also used for IDs in search results; CdxTypeaheadSearch has no slot for
   results, so its ID (`match`) is styled via Codex's classes */
.dd-entity-id,
.dd-id-chip,
.cdx-typeahead-search
  .cdx-menu-item__text
  > .cdx-search-result-title
  + .cdx-search-result-title {
  border: 1px solid var(--border-color-subtle);
  font: inherit;
  line-height: inherit;
  margin-inline-start: 0.35em;
  padding: 0.05em 0.35em;
  border-radius: var(--border-radius-base);
  background: var(--background-color-neutral-subtle);
  color: var(--color-subtle);
  font-size: 0.75em;
  font-weight: normal;
  white-space: nowrap;
}
.dd-id-chip,
.cdx-typeahead-search .cdx-search-result-title + .cdx-search-result-title {
  font-family: var(--font-family-monospace);
}
.dd-entity-id code {
  all: unset;
  font-family: var(--font-family-monospace);
}
.dd-entity-id:hover {
  color: var(--color-progressive);
}
</style>
