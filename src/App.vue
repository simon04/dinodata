<template>
  <div class="vector-header-container">
    <div class="vector-header mw-header dd-header">
      <span class="dd-logo">
        <button
          class="dd-dino"
          title="Why DinoData?"
          @click="showDialog = true"
        >
          🦕
        </button>
        <a href="#">DinoData</a>
      </span>
      <EntitySearch class="dd-search" :language="language" @select="go" />
      <LanguageSelector v-model="language" />
    </div>
  </div>

  <cdx-dialog
    v-model:open="showDialog"
    title="Wikimania 2024 Hackathon"
    :use-close-button="true"
  >
    <a
      href="https://commons.wikimedia.org/wiki/File:Wikimania_2024_Dragons_in_love_illustration_(beige_background).png"
      title="By Illustrated by Kasia Ostrowska (bazgra_nina) – Wikimedia Foundation – Logos of Wikimania 2024, CC0"
      target="_blank"
      rel="external noopener"
    >
      <img
        style="max-width: 100%; max-height: 80vh"
        src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Wikimania_2024_Dragons_in_love_illustration_%28beige_background%29.png"
      />
    </a>
  </cdx-dialog>

  <main class="mw-page-container">
    <EntityView v-if="id" :id="id" :language="language" />
    <section v-else>
      <h1>Welcome to DinoData</h1>
      <p>A friendly face for Wikidata. Search above, or try:</p>
      <ul>
        <li><a href="#Q40">Austria (Q40)</a></li>
        <li><a href="#Q1735">Innsbruck (Q1735)</a></li>
        <li><a href="#Q42">Douglas Adams (Q42)</a></li>
        <li><a href="#Q430">Dinosaur (Q430)</a></li>
        <li><a href="#Q14384">Tyrannosaurus (Q14384)</a></li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useEventListener, useLocalStorage } from "@vueuse/core";
import { CdxDialog } from "@wikimedia/codex";
import { loadProperties } from "./properties";
import LanguageSelector from "./components/LanguageSelector.vue";
import EntitySearch from "./components/EntitySearch.vue";
import EntityView from "./components/EntityView.vue";

const language = useLocalStorage(
  "dinodata.language",
  navigator.language.split("-")[0].toLowerCase() || "en",
);
watchEffect(() => (document.documentElement.lang = language.value));
loadProperties(language);

const showDialog = ref(false);

const parseHash = () => location.hash.match(/^#([LPQ]\d+)$/)?.[1];
const id = ref(parseHash());
useEventListener(window, "hashchange", () => {
  id.value = parseHash();
  window.scrollTo(0, 0);
});

function go(entityId: string) {
  location.hash = entityId;
}
</script>

<style>
@import "@wikimedia/codex/dist/codex.style-bidi.css";
@import "@wikimedia/codex-design-tokens/theme-wikimedia-ui.css";

:root {
  /* native font stacks, as in Bootstrap 5 (https://getbootstrap.com/docs/5.3/content/reboot/#native-font-stack) */
  --font-family-base:
    system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans",
    "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
  --font-family-monospace:
    SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;
}
html,
body,
h1,
h2,
h3,
input,
button,
textarea,
select {
  font-family: var(--font-family-base);
}
code,
kbd,
pre,
samp {
  font-family: var(--font-family-monospace);
  font-size: 0.875em;
}
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.dd-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.dd-logo {
  display: flex;
  gap: 0.25rem;
  font-size: 1.5rem;
  font-weight: bold;
  white-space: nowrap;
  color: inherit;
}
.dd-logo a {
  color: inherit;
}
.dd-dino {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
.dd-search {
  flex: 1;
  max-width: 40rem;
}
main {
  padding: 1rem;
}
</style>
