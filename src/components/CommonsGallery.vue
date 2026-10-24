<template>
  <div class="dd-gallery">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <p v-else-if="!loading && !files.length">{{ t("gallery-none") }}</p>
    <ul v-if="files.length" class="dd-gallery-grid">
      <li v-for="file in files" :key="file">
        <button
          type="button"
          class="dd-gallery-card"
          :title="infos[file]?.description"
          @click="mediaFile = file"
        >
          <!-- mounted once the thumbnail is known: Codex keeps a broken state -->
          <cdx-image
            v-if="infos[file]"
            :src="infos[file].url"
            alt=""
            aspect-ratio="4:3"
            object-fit="cover"
          />
          <span v-else class="dd-gallery-placeholder" />
          <span class="dd-gallery-text">
            <span class="dd-gallery-title">{{ name(file) }}</span>
            <span
              v-if="infos[file]?.date || infos[file]?.artist"
              class="dd-gallery-meta"
            >
              {{
                [infos[file]?.date, infos[file]?.artist]
                  .filter(Boolean)
                  .join(" · ")
              }}
            </span>
          </span>
        </button>
      </li>
    </ul>
    <p class="dd-gallery-actions">
      <cdx-progress-indicator v-if="loading" show-label>
        {{ t("backlinks-loading") }}
      </cdx-progress-indicator>
      <cdx-button v-else-if="next" @click="load">
        {{ t("backlinks-more") }}
      </cdx-button>
      <a
        :href="`https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(category)}`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("gallery-commons") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  CdxButton,
  CdxImage,
  CdxMessage,
  CdxProgressIndicator,
} from "@wikimedia/codex";
import { t } from "../i18n";
import {
  getCategoryFiles,
  getFileInfos,
  useMediaDialog,
  type FileInfo,
} from "../commons";

/** category name without the `Category:` prefix */
const props = defineProps<{ category: string; language: string }>();

const files = ref<string[]>([]);
const infos = ref<Record<string, FileInfo>>({});
const next = ref<Record<string, string>>();
const loading = ref(false);
const error = ref<string>();
const mediaFile = useMediaDialog();

/** file name without extension */
const name = (file: string) => file.replace(/\.[^.]+$/, "");

/** thumbnails for the card width (see CSS) in physical pixels */
const THUMB_WIDTH = Math.round(320 * Math.min(window.devicePixelRatio, 2));

async function load() {
  loading.value = true;
  try {
    const result = await getCategoryFiles(props.category, next.value);
    files.value.push(...result.files);
    next.value = result.next;
    await getFileInfos(
      result.files,
      THUMB_WIDTH,
      props.language,
      (batch) => (infos.value = { ...infos.value, ...batch }),
    );
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}
load();
</script>

<style scoped>
.dd-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dd-gallery-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background: var(--background-color-base);
  color: inherit;
  font: inherit;
  text-align: start;
  overflow: hidden;
  cursor: zoom-in;
  transition-property: var(--transition-property-base);
  transition-duration: var(--transition-duration-medium);
}
.dd-gallery-card:hover {
  box-shadow: var(--box-shadow-medium);
}
.dd-gallery-card:focus-visible {
  outline: var(--border-width-thick) solid
    var(--outline-color-progressive--focus);
}
.dd-gallery-card :deep(.cdx-image),
.dd-gallery-card :deep(.cdx-image__image) {
  width: 100%;
}
.dd-gallery-placeholder {
  aspect-ratio: 4 / 3;
  background: var(--background-color-interactive-subtle);
}
.dd-gallery-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem 0.625rem;
  min-width: 0;
}
.dd-gallery-title {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.dd-gallery-meta {
  color: var(--color-subtle);
  font-size: 0.875em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dd-gallery-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
