<template>
  <div class="vector-header-container">
    <div class="vector-header mw-header dd-header">
      <a href="#" class="dd-logo">🦕 DinoData</a>
      <EntitySearch class="dd-search" :language="language" @select="go" />
      <LanguageSelector v-model="language" />
    </div>
  </div>

  <main class="mw-page-container">
    <EntityView v-if="id" :id="id" :language="language" />
    <section v-else>
      <h1>Welcome to DinoData</h1>
      <p>A friendly face for Wikidata. Search above, or try:</p>
      <ul>
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

.dd-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.dd-logo {
  font-size: 1.5rem;
  font-weight: bold;
  white-space: nowrap;
  color: inherit;
}
.dd-search {
  flex: 1;
  max-width: 40rem;
}
main {
  padding: 1rem;
}
</style>
