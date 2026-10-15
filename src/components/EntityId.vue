<template>
  <code class="dd-entity-id" :title="`Copy ${id}`" @click.prevent="copy(id)">
    {{ copied ? "copied" : id }}
  </code>
</template>

<script setup lang="ts">
import { useClipboard } from "@vueuse/core";

defineProps<{ id: string }>();
const { copy, copied } = useClipboard({ copiedDuring: 800 });
</script>

<style>
.dd-entity-id {
  margin-left: 0.35em;
  padding: 0.05em 0.35em;
  border-radius: var(--border-radius-base);
  background: var(--background-color-neutral-subtle);
  color: var(--color-subtle);
  font-size: 0.75em;
  font-weight: normal;
  cursor: copy;
  white-space: nowrap;
}
.dd-entity-id:hover {
  color: var(--color-progressive);
}
</style>
