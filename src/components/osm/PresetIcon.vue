<template>
  <span
    class="dd-preset-icon"
    :class="{ 'dd-preset-icon--empty': !url }"
    :style="url ? { '--dd-icon': `url(${JSON.stringify(url)})` } : undefined"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { iconUrl } from "../../osm/presets";

/** Preset icon (maki, temaki, Font Awesome, iD) in the current text color. */
const props = defineProps<{ icon?: string }>();
const url = computed(() => iconUrl(props.icon));
</script>

<style scoped>
.dd-preset-icon {
  display: inline-block;
  flex-shrink: 0;
  width: 1.25em;
  height: 1.25em;
  vertical-align: -0.2em;
  background-color: currentColor;
  mask: var(--dd-icon) center / contain no-repeat;
}
.dd-preset-icon--empty {
  border-radius: 50%;
  mask: none;
  background-color: var(--background-color-disabled);
}
</style>
