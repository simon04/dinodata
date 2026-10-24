<template>
  <div class="vector-header-container">
    <div class="vector-header mw-header dd-header">
      <span class="dd-logo">
        <button
          class="dd-dino"
          :title="t('app-why-dinodata')"
          :aria-label="t('app-why-dinodata')"
          @click="showDialog = true"
        >
          <img :src="dragons" alt="" />
        </button>
        <a href="#">DinoData</a>
        <a v-if="route.mode === 'osm'" class="dd-mode" href="#osm">OSM</a>
      </span>
      <OsmHeaderSearch
        v-if="route.mode === 'osm'"
        class="dd-search"
        :language="language"
        @select="go"
      />
      <HeaderSearch
        v-else
        class="dd-search"
        :language="language"
        @select="go"
      />
      <LanguageSelector v-model="language" />
      <UserMenu :mode="route.mode" />
    </div>
  </div>

  <cdx-dialog
    v-model:open="showDialog"
    :title="t('app-dialog-title')"
    :use-close-button="true"
  >
    <a
      href="https://commons.wikimedia.org/wiki/File:Wikimania_2024_Dragons_in_love_illustration_(beige_background).png"
      :title="t('app-dialog-image-credit')"
      target="_blank"
      rel="external noopener"
    >
      <img
        style="max-width: 100%; max-height: 80vh"
        src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Wikimania_2024_Dragons_in_love_illustration_%28beige_background%29.png"
      />
    </a>
    <p>
      {{ t("app-hackathon") }}
      <a
        href="https://wikimania.wikimedia.org/wiki/2024:Hackathon"
        target="_blank"
        rel="external noopener"
      >
        {{ t("app-hackathon-link") }}
      </a>
    </p>
    <p class="dd-credit">{{ t("app-dialog-image-credit") }}</p>
  </cdx-dialog>

  <main class="mw-page-container">
    <template v-if="route.mode === 'osm'">
      <OsmElementView
        v-if="route.ref"
        :osm-ref="route.ref"
        :language="language"
      />
      <OsmHome v-else :language="language" :search="route.search" />
    </template>
    <EntityView
      v-else-if="route.id"
      :id="route.id"
      :compare="route.compare"
      :language="language"
    />
    <section v-else class="dd-home">
      <div>
        <h1>{{ t("app-welcome") }}</h1>
        <p class="dd-intro">{{ t("app-intro") }}</p>
        <p>{{ t("app-try") }}</p>
        <ul>
          <li v-for="[id, name] in EXAMPLES" :key="id">
            <a :href="`#${id}`">{{ examples[id]?.label ?? name }}</a>
            <code class="dd-id-chip">{{ id }}</code>
            <span
              v-if="examples[id]?.description"
              class="dd-example-description"
            >
              {{ examples[id].description }}
            </span>
          </li>
        </ul>
        <p class="dd-osm-teaser">
          <a href="#osm">{{ t("osm-teaser") }}</a>
        </p>
      </div>
      <aside class="dd-hackathon">
        <button class="dd-hackathon-image" @click="showDialog = true">
          <img
            src="https://commons.wikimedia.org/wiki/Special:FilePath/Wikimania_2024_Dragons_in_love_illustration_(beige_background).png?width=480"
            :alt="t('app-dialog-title')"
          />
        </button>
      </aside>
    </section>
  </main>

  <MediaDialog />
  <cdx-toast-container />

  <footer class="dd-footer">
    <span>
      DinoData
      {{ t("footer-by") }}
      <a
        href="https://github.com/simon04"
        target="_blank"
        rel="external noopener"
      >
        Simon Legner (simon04)
      </a>
    </span>
    <a
      href="https://github.com/simon04/dinodata"
      target="_blank"
      rel="external noopener"
    >
      <svg
        class="dd-github"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
        />
      </svg>
      {{ t("footer-source") }}
    </a>
    <a
      href="https://github.com/simon04/dinodata/blob/master/LICENSE"
      target="_blank"
      rel="external noopener license"
    >
      {{ t("footer-license", "GPL-3.0") }}
    </a>
    <a
      href="https://www.wikidata.org/wiki/Wikidata:Licensing"
      target="_blank"
      rel="external noopener"
    >
      {{ t("footer-data") }}
    </a>
    <a
      v-if="commitHash"
      :href="`https://github.com/simon04/dinodata/commit/${commitHash}`"
      target="_blank"
      rel="external noopener"
    >
      {{ commitHash }} ({{ commitDate }})
    </a>
  </footer>
</template>

<script setup lang="ts">
import { isRTL, language, t } from "./i18n";
import { defineAsyncComponent, ref, watch, watchEffect } from "vue";
import {
  computedAsync,
  useEventListener,
  useTextDirection,
} from "@vueuse/core";
import { CdxDialog, CdxToastContainer } from "@wikimedia/codex";
import { loadProperties } from "./properties";
import { description, fallbackLanguages, getEntities, label } from "./wikidata";
import LanguageSelector from "./components/LanguageSelector.vue";
import UserMenu from "./components/UserMenu.vue";
import HeaderSearch from "./components/HeaderSearch.vue";
import EntityView from "./components/EntityView.vue";
import MediaDialog from "./components/MediaDialog.vue";
import dragons from "./assets/dragons.svg";
import { parseRoute } from "./route";
import { useSchema } from "./osm/presets";

const commitHash = import.meta.env.VITE_COMMIT_HASH;
const commitDate = import.meta.env.VITE_COMMIT_DATE;

// OSM mode is loaded on demand
const OsmElementView = defineAsyncComponent(
  () => import("./components/osm/OsmElementView.vue"),
);
const OsmHome = defineAsyncComponent(
  () => import("./components/osm/OsmHome.vue"),
);
const OsmHeaderSearch = defineAsyncComponent(
  () => import("./components/osm/OsmHeaderSearch.vue"),
);

const EXAMPLES = [
  ["Q113654417", "The Dragons in Love"],
  ["Q40", "Austria"],
  ["Q1741", "Vienna"],
  ["Q18559623", "Wikimedia Austria"],
  ["Q1735", "Innsbruck"],
  ["Q96694010", "Marktplatz, Innsbruck"],
  ["Q357751", "Serles"],
  ["Q42", "Douglas Adams"],
  ["Q430", "Dinosaur"],
  ["Q7559", "Dragon"],
  ["Q463190", "Wawel Dragon"],
  ["Q141746631", "DinoData"],
];
const dir = useTextDirection();
watchEffect(() => {
  document.documentElement.lang = language.value;
  dir.value = isRTL() ? "rtl" : "ltr";
});
const showDialog = ref(false);

const route = ref(parseRoute(location.hash));
useEventListener(window, "hashchange", () => {
  route.value = parseRoute(location.hash);
  window.scrollTo(0, 0);
});

// preload what the mode needs, once: Wikidata properties, or OSM presets
let propertiesLoading = false;
let schemaLoading = false;
watch(
  () => route.value.mode,
  (mode) => {
    if (mode === "wikidata" && !propertiesLoading) {
      propertiesLoading = true;
      loadProperties(language);
    }
    if (mode === "osm" && !schemaLoading) {
      schemaLoading = true;
      useSchema().load(language);
    }
  },
  { immediate: true },
);

/**
 * Labels and descriptions in the selected language (English names until
 * loaded), only fetched while shown on the home page.
 */
const examples = computedAsync(
  async () => {
    const lang = language.value;
    const ids = EXAMPLES.map(([example]) => example);
    const entities = await getEntities(
      ids,
      "labels|descriptions",
      fallbackLanguages(lang),
    );
    return Object.fromEntries(
      ids.map((example) => [
        example,
        {
          label: label(entities[example], lang),
          description: description(entities[example], lang),
        },
      ]),
    );
  },
  {} as Record<string, { label?: string; description?: string }>,
  { lazy: true, onError: console.warn },
);

/** Navigate to an item ID (`Q42`) or hash (`#osm/way/1`). */
function go(target: string) {
  location.hash = target;
}
</script>

<style>
@import "@wikimedia/codex/dist/codex.style-bidi.css";
@import "@wikimedia/codex-design-tokens/theme-wikimedia-ui.css";
@import "@wikimedia/codex-design-tokens/theme-wikimedia-ui-mode-dark.css"
  (prefers-color-scheme: dark);

:root {
  color-scheme: light dark;
}
html,
body {
  background-color: var(--background-color-base);
  color: var(--color-base);
}
/* Codex typography: system sans-serif stack, serif for the page title
   https://doc.wikimedia.org/codex/latest/style-guide/typography.html */
html,
body,
h2,
h3,
input,
button,
textarea,
select {
  font-family: var(--font-family-system-sans);
}
h1 {
  font-family: var(--font-family-serif);
  font-weight: normal;
}
code,
kbd,
pre,
samp {
  font-family: var(--font-family-monospace);
  font-size: var(--font-size-small);
}

.dd-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
}
.dd-table caption {
  text-align: start;
  font-weight: bold;
  padding: 0.25rem 0;
}
.dd-table th,
.dd-table td {
  border-bottom: 1px solid var(--border-color-subtle);
  padding: 0.25rem 0.5rem;
  text-align: start;
  vertical-align: top;
}
.dd-table th {
  background: var(--background-color-neutral-subtle);
}
.dd-table .dd-changed {
  background: var(--background-color-success-subtle);
}
.dd-table tr.dd-removed {
  background: var(--background-color-error-subtle);
}

.dd-home {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: space-between;
  align-items: flex-start;
}
.dd-home li + li {
  margin-top: 0.5rem;
}
.dd-intro {
  max-width: 40rem;
}
.dd-example-description {
  color: var(--color-subtle);
  margin-inline-start: 0.25rem;
}
.dd-hackathon {
  display: flex;
  flex-direction: column;
  width: 20rem;
  max-width: 100%;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  overflow: hidden;
  box-shadow: var(--box-shadow-medium);
}
.dd-hackathon-image {
  all: unset;
  cursor: zoom-in;
  background: #f9eec0;
}
.dd-hackathon-image img {
  display: block;
  width: 100%;
}
.dd-credit {
  font-size: 0.8125em;
  color: var(--color-subtle);
}

.dd-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1.5rem;
  margin-top: 2rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color-subtle);
  font-size: 0.875em;
  color: var(--color-subtle);
}
.dd-footer a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.dd-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-block: 0.75rem;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  line-height: 1;
  font-size: 1.5rem;
  font-weight: bold;
  white-space: nowrap;
  color: inherit;
}
.dd-logo a {
  color: inherit;
}
.dd-mode {
  padding: 0.15em 0.4em;
  border-radius: var(--border-radius-base);
  background: var(--background-color-progressive-subtle);
  font-size: 0.6em;
}
.dd-osm-teaser {
  margin-top: 1.5rem;
}
.dd-dino {
  display: flex;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}
.dd-dino img {
  height: 2.25rem;
}
/* light outline for the black dragons */
@media (prefers-color-scheme: dark) {
  .dd-dino img {
    filter: drop-shadow(0 0 0.5px var(--color-base))
      drop-shadow(0 0 0.5px var(--color-base));
  }
}
.dd-search {
  flex: 1;
  max-width: 40rem;
}
main {
  padding: 1rem;
}
</style>
