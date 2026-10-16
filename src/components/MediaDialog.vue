<template>
  <cdx-dialog
    :open="!!file"
    class="dd-media-dialog"
    :title="file ?? ''"
    :use-close-button="true"
    :close-button-label="t('cancel')"
    @update:open="(open: boolean) => open || (file = undefined)"
  >
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <div v-else-if="info && !evaluating" class="dd-media-full">
      <img
        :src="info.url"
        :width="info.width / devicePixelRatio"
        :height="info.height / devicePixelRatio"
        alt=""
      />
      <p class="dd-media-credit">
        <span v-if="info.artist">{{ info.artist }}</span>
        <span v-if="info.license">{{ info.license }}</span>
        <a :href="info.descriptionUrl" target="_blank" rel="external noopener">
          {{ t("media-commons") }}
        </a>
      </p>
    </div>
    <cdx-progress-indicator v-else show-label>
      {{ t("media-loading") }}
    </cdx-progress-indicator>
  </cdx-dialog>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { CdxDialog, CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { getImageInfo, useMediaDialog } from "../commons";

const file = useMediaDialog();
const { devicePixelRatio } = window;
const error = ref<string>();
const evaluating = ref(false);

/** thumbnail fitting the dialog in physical pixels */
const info = computedAsync(
  async () => {
    error.value = undefined;
    if (!file.value) return undefined;
    return getImageInfo(
      file.value,
      Math.round(window.innerWidth * 0.9 * devicePixelRatio),
      Math.round(window.innerHeight * 0.75 * devicePixelRatio),
    );
  },
  undefined,
  { evaluating, onError: (e) => (error.value = String(e)) },
);
</script>

<style>
/* Codex dialogs are teleported: not scoped */
.cdx-dialog.dd-media-dialog {
  max-width: calc(100vw - 2rem);
  width: auto;
}
.dd-media-full {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.dd-media-full img {
  max-width: 100%;
  height: auto;
  max-height: 75vh;
  object-fit: contain;
}
.dd-media-credit {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1rem;
  margin-bottom: 0;
  color: var(--color-subtle);
  font-size: var(--font-size-small);
}
</style>
