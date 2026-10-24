<template>
  <div ref="root" class="dd-sitelinks-table">
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
          v-tooltip="t('undo')"
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
          v-tooltip="t('remove')"
          @click="setSitelink(row.site, '')"
        >
          <cdx-icon :icon="cdxIconTrash" size="small" />
        </cdx-button>
      </div>
    </div>
    <div class="dd-sitelink-add">
      <cdx-lookup
        v-model:selected="selectedSite"
        v-model:input-value="newSite"
        class="dd-site-lookup"
        :menu-items="siteItems"
        :menu-config="{ visibleItemLimit: 8 }"
        :aria-label="t('sitelinks-site')"
        :status="tried && !siteValid ? 'error' : 'default'"
        :placeholder="t('sitelinks-placeholder-site')"
        @input="onSiteInput"
        @update:selected="onSiteSelected"
      >
        <template #no-results>{{ t("sitelinks-no-site") }}</template>
      </cdx-lookup>
      <cdx-text-input
        ref="titleInput"
        v-model="newTitle"
        :aria-label="t('sitelinks-title')"
        :status="tried && !newTitle.trim() ? 'error' : 'default'"
        :placeholder="t('sitelinks-title')"
        @keydown.enter="add"
      />
      <cdx-button @click="add">
        <cdx-icon :icon="cdxIconAdd" />
        {{ t("add-sitelink") }}
      </cdx-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxLookup,
  CdxTextInput,
  type MenuItemData,
} from "@wikimedia/codex";
import { useElementVisibility } from "@vueuse/core";
import {
  cdxIconAdd,
  cdxIconLinkExternal,
  cdxIconTrash,
  cdxIconUndo,
} from "@wikimedia/codex-icons";
import { t } from "../i18n";
import type { Edit } from "../quickstatements";
import type { Entity } from "../wikidata";
import { getSites, searchSites, type Site } from "../sites";
import EditableText from "./EditableText.vue";

const props = defineProps<{ entity: Entity }>();
const edits = defineModel<Edit[]>("edits", { required: true });

const newSite = ref("");
const newTitle = ref("");
const selectedSite = ref<string | null>(null);
const siteItems = ref<MenuItemData[]>([]);
const titleInput =
  useTemplateRef<InstanceType<typeof CdxTextInput>>("titleInput");

/** sites for sitelinks, loaded when the tab is first shown */
const sites = shallowRef<Map<string, Site>>();
const visible = useElementVisibility(useTemplateRef("root"));
const stop = watch(visible, (shown) => {
  if (!shown) return;
  stop();
  getSites()
    .then((s) => (sites.value = s))
    .catch(console.warn);
});

function onSiteInput(value: string) {
  const linked = new Set(rows.value.map((r) => r.site));
  siteItems.value = searchSites(sites.value?.values() ?? [], value)
    .filter((s) => !linked.has(s.id))
    .map((s) => ({
      value: s.id,
      label: s.id,
      match: s.name === s.id ? undefined : s.name,
      description: s.url.replace(/^https:\/\//, ""),
    }));
}

function onSiteSelected(id: string | null) {
  if (!id) return;
  newSite.value = id;
  titleInput.value?.focus();
}

/** a known site, or anything while the sites are not loaded */
const siteValid = computed(() => {
  const site = newSite.value.trim();
  return !!site && (!sites.value || sites.value.has(site));
});

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

const tried = ref(false);

function add() {
  const site = newSite.value.trim();
  const title = newTitle.value.trim();
  tried.value = true;
  if (!siteValid.value || !title) return;
  tried.value = false;
  setSitelink(site, title);
  newSite.value = "";
  newTitle.value = "";
  selectedSite.value = null;
}

function siteUrl(site: string, title: string): string {
  const url = sites.value?.get(site)?.url;
  if (url) return `${url}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
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
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
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
/* reveal on hover; always visible on touch devices */
@media (hover: hover) {
  .dd-hover {
    opacity: 0;
  }
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
.dd-site-lookup {
  flex: 0 0 16rem;
}
</style>
