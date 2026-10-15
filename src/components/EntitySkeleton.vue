<template>
  <div class="dd-skeleton" aria-busy="true" :aria-label="t('loading')">
    <cdx-progress-bar inline aria-hidden="true" />
    <div class="dd-bone dd-title" />
    <div class="dd-bone dd-line" style="width: 40%" />
    <div class="dd-bone dd-line" style="width: 25%" />
    <div class="dd-bone dd-tabs" />
    <div v-for="i in 5" :key="i" class="dd-group">
      <div class="dd-bone dd-line" style="width: 70%" />
      <div>
        <div
          class="dd-bone dd-line"
          :style="{ width: `${30 + ((i * 17) % 50)}%` }"
        />
        <div class="dd-bone dd-line dd-small" style="width: 50%" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { CdxProgressBar } from "@wikimedia/codex";
</script>

<style scoped>
.dd-skeleton .cdx-progress-bar {
  margin-bottom: 1.5rem;
}
.dd-bone {
  border-radius: var(--border-radius-base);
  background: linear-gradient(
    90deg,
    var(--background-color-interactive-subtle) 25%,
    var(--background-color-interactive) 50%,
    var(--background-color-interactive-subtle) 75%
  );
  background-size: 200% 100%;
  animation: dd-shimmer 1.2s ease-in-out infinite;
}
.dd-title {
  height: 2.25rem;
  width: 30%;
  margin-bottom: 1rem;
}
.dd-line {
  height: 1rem;
  margin-bottom: 0.75rem;
}
.dd-small {
  height: 0.75rem;
}
.dd-tabs {
  height: 2rem;
  width: 50%;
  margin: 2rem 0 1rem;
}
.dd-group {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) 3fr;
  gap: 1.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  margin-bottom: 0.75rem;
}
@keyframes dd-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dd-bone {
    animation: none;
  }
}
</style>
