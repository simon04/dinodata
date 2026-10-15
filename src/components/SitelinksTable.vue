<template>
  <div class="dd-sitelinks-table">
    <div class="dd-sitelinks-grid">
      <div
        v-for="row in rows"
        :key="row.site"
        class="dd-sitelink-row"
        :class="{
          'dd-changed': row.changed && row.title,
          'dd-removed': row.changed && !row.title,
        }"
      >
        <code class="dd-site">{{ row.site }}</code>
        <EditableText
          class="dd-title"
          :model-value="row.title"
          @update:model-value="setSitelink(row.site, $event)"
        />
        <a
          v-if="row.title"
          :href="siteUrl(row.site, row.title)"
          target="_blank"
          rel="external noopener"
          :title="row.title"
        >
          <cdx-icon :icon="cdxIconLinkExternal" size="small" />
        </a>
        <cdx-button
          v-if="row.changed"
          weight="quiet"
          size="small"
          :aria-label="t('undo')"
          :title="t('undo')"
          @click="undo(row.site)"
        >
          <cdx-icon :icon="cdxIconUndo" size="small" />
        </cdx-button>
        <cdx-button
          v-else
          class="dd-hover"
          weight="quiet"
          action="destructive"
          size="small"
          :aria-label="t('remove')"
          :title="t('remove')"
          @click="setSitelink(row.site, '')"
        >
          <cdx-icon :icon="cdxIconTrash" size="small" />
        </cdx-button>
      </div>
    </div>
    <div class="dd-sitelink-add">
      <cdx-text-input
        v-model="newSite"
        :placeholder="t('sitelinks-placeholder-site')"
        @keydown.enter="add"
      />
      <cdx-text-input
        v-model="newTitle"
        :placeholder="t('sitelinks-title')"
        @keydown.enter="add"
      />
      <cdx-button :disabled="!newSite.trim() || !newTitle.trim()" @click="add">
        <cdx-icon :icon="cdxIconAdd" />
        {{ t("add-sitelink") }}
      </cdx-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CdxButton, CdxIcon, CdxTextInput } from "@wikimedia/codex";
import {
  cdxIconAdd,
  cdxIconLinkExternal,
  cdxIconTrash,
  cdxIconUndo,
} from "@wikimedia/codex-icons";
import { t } from "../i18n";
import type { Edit } from "../quickstatements";
import type { Entity } from "../wikidata";
import EditableText from "./EditableText.vue";

const props = defineProps<{ entity: Entity }>();
const edits = defineModel<Edit[]>("edits", { required: true });

const newSite = ref("");
const newTitle = ref("");

type SitelinkEdit = Extract<Edit, { type: "sitelink" }>;

const rows = computed(() => {
  const original = Object.fromEntries(
    Object.values(props.entity.sitelinks ?? {}).map((s) => [s.site, s.title]),
  );
  const changes = Object.fromEntries(
    edits.value
      .filter((e): e is SitelinkEdit => e.type === "sitelink")
      .map((e) => [e.site, e.title]),
  );
  return [...new Set([...Object.keys(original), ...Object.keys(changes)])]
    .sort()
    .map((site) => ({
      site,
      title: changes[site] ?? original[site] ?? "",
      changed: site in changes,
    }));
});

function setSitelink(site: string, title: string) {
  const original = props.entity.sitelinks?.[site]?.title ?? "";
  const rest = edits.value.filter(
    (e) => !(e.type === "sitelink" && e.site === site),
  );
  edits.value =
    title === original ? rest : [...rest, { type: "sitelink", site, title }];
}

function undo(site: string) {
  edits.value = edits.value.filter(
    (e) => !(e.type === "sitelink" && e.site === site),
  );
}

function add() {
  const site = newSite.value.trim();
  const title = newTitle.value.trim();
  if (!site || !title) return;
  setSitelink(site, title);
  newSite.value = "";
  newTitle.value = "";
}

function siteUrl(site: string, title: string): string {
  const special: Record<string, string> = {
    commonswiki: "commons.wikimedia.org",
    specieswiki: "species.wikimedia.org",
    metawiki: "meta.wikimedia.org",
    wikidatawiki: "www.wikidata.org",
  };
  const m = site.match(
    /^(.+?)(wiki|wikivoyage|wikiquote|wikisource|wikinews|wikibooks|wikiversity|wiktionary)$/,
  );
  const project = m?.[2] === "wiki" ? "wikipedia" : m?.[2];
  const host =
    special[site] ?? (m ? `${m[1].replace(/_/g, "-")}.${project}.org` : site);
  return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
</script>

<style scoped>
.dd-sitelinks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  margin-top: 0.75rem;
  border-top: 1px solid var(--border-color-subtle);
}
.dd-sitelink-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2rem;
  padding: 0 0.25rem 0 0.5rem;
  border-bottom: 1px solid var(--border-color-subtle);
}
.dd-site {
  flex: 0 0 8.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dd-title {
  flex: 1;
  min-width: 0;
}
.dd-changed {
  background: var(--background-color-success-subtle);
}
.dd-removed {
  background: var(--background-color-error-subtle);
}
.dd-removed .dd-title {
  text-decoration: line-through;
}
.dd-hover {
  opacity: 0;
}
.dd-sitelink-row:hover .dd-hover,
.dd-hover:focus {
  opacity: 1;
}
.dd-sitelink-add {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
