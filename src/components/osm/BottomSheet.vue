<template>
  <dialog
    ref="dialog"
    class="dd-sheet"
    :aria-label="title"
    @close="open = false"
    @click="onBackdrop"
  >
    <div class="dd-sheet-content">
      <header class="dd-sheet-header">
        <span class="dd-sheet-handle" aria-hidden="true" />
        <h2 class="dd-sheet-title">
          <slot name="title">{{ title }}</slot>
        </h2>
        <cdx-button
          weight="quiet"
          :aria-label="t('close')"
          @click="open = false"
        >
          <cdx-icon :icon="cdxIconClose" />
        </cdx-button>
      </header>
      <div class="dd-sheet-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="dd-sheet-footer">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import { CdxButton, CdxIcon } from "@wikimedia/codex";
import { cdxIconClose } from "@wikimedia/codex-icons";
import { t } from "../../i18n";

/**
 * Modal sheet: slides up from the bottom on phones (thumb reach), a centered
 * dialog on wider screens. Native <dialog>: focus trap, Escape, backdrop.
 */
defineProps<{ title?: string }>();
const open = defineModel<boolean>("open", { default: false });
const dialog = useTemplateRef<HTMLDialogElement>("dialog");

watch(
  [open, dialog],
  ([value, d]) => {
    if (!d) return;
    if (value && !d.open) d.showModal();
    else if (!value && d.open) d.close();
  },
  { immediate: true },
);

/** Clicks on the backdrop (the dialog element itself) close the sheet. */
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false;
}
</script>

<style scoped>
.dd-sheet {
  padding: 0;
  border: none;
  max-width: 100vw;
  max-height: 90dvh;
  width: 100%;
  margin: auto auto 0;
  border-radius: 1rem 1rem 0 0;
  background: var(--background-color-base);
  color: var(--color-base);
  box-shadow: var(--box-shadow-large);
}
.dd-sheet[open] {
  animation: dd-sheet-up var(--transition-duration-medium, 250ms) ease-out;
}
.dd-sheet::backdrop {
  background: var(--background-color-backdrop-light, rgb(255 255 255 / 65%));
}
@media (prefers-color-scheme: dark) {
  .dd-sheet::backdrop {
    background: rgb(0 0 0 / 60%);
  }
}
@keyframes dd-sheet-up {
  from {
    transform: translateY(30%);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dd-sheet[open] {
    animation: none;
  }
}
.dd-sheet-content {
  display: flex;
  flex-direction: column;
  max-height: 90dvh;
}
.dd-sheet-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem 0.25rem 1rem;
}
.dd-sheet-handle {
  position: absolute;
  top: 0.35rem;
  left: 50%;
  width: 2.5rem;
  height: 0.25rem;
  margin-left: -1.25rem;
  border-radius: 0.125rem;
  background: var(--border-color-base);
}
.dd-sheet-title {
  flex: 1;
  margin: 0;
  padding: 0;
  border: none;
  font-family: var(--font-family-system-sans);
  font-weight: bold;
  font-size: 1.1em;
  overflow-wrap: anywhere;
}
.dd-sheet-body {
  overflow-y: auto;
  padding: 0.25rem 1rem 1rem;
  overscroll-behavior: contain;
}
.dd-sheet-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  /* above the home indicator on phones */
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-color-subtle);
}
@media (min-width: 640px) {
  .dd-sheet {
    width: 36rem;
    margin: auto;
    border-radius: var(--border-radius-base);
  }
  .dd-sheet-handle {
    display: none;
  }
}
</style>
