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

<style scoped src="./diff.css"></style>

<style scoped>
.dd-diff-entity {
  display: inline-flex;
  align-items: baseline;
}
</style>
