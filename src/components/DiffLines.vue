<template>
  <div class="dd-diff">
    <div
      v-for="(line, j) in lines"
      :key="j"
      :class="line.type === '+' ? 'dd-diff-add' : 'dd-diff-del'"
    >
      <span class="dd-diff-marker" aria-hidden="true">{{ line.type }}</span>
      <component :is="line.type === '+' ? 'ins' : 'del'">
        <template v-for="(part, k) in tokenize(line.text)" :key="k">
          <!-- the item itself (starting each line) just by ID -->
          <code v-if="!part.id || part.id === id">{{ part.text }}</code>
          <span v-else class="dd-diff-entity">
            <a :href="`#${part.id}`" v-tooltip="descriptions[part.id]">
              {{ labels[part.id] ?? part.id }}
            </a>
            <code class="dd-id-chip">{{ part.text }}</code>
          </span>
        </template>
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
import { tokenize, type DiffLine } from "../history";

/** Changes as QuickStatements lines, with labels for the linked IDs. */
defineProps<{
  id: string;
  lines: DiffLine[];
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}>();
</script>

<style scoped>
.dd-diff-add,
.dd-diff-del {
  /* the background also behind long lines */
  min-width: 100%;
  width: max-content;
  display: flex;
  gap: 0.5rem;
  padding-inline: 0.25rem;
  line-height: 1.6;
}
.dd-diff-add {
  background: var(--background-color-success-subtle);
}
.dd-diff-del {
  background: var(--background-color-error-subtle);
}
/* flex: no whitespace between the parts of a line */
.dd-diff-add ins,
.dd-diff-del del {
  display: flex;
  align-items: baseline;
  text-decoration: none;
}
.dd-diff-marker {
  flex: none;
  font-family: monospace;
  user-select: none;
}
/* QuickStatements syntax without the code boxes of the skin */
.dd-diff code:not(.dd-id-chip) {
  padding: 0;
  border: 0;
  background: none;
  white-space: pre;
}
.dd-diff-entity {
  display: inline-flex;
  align-items: baseline;
}
</style>
