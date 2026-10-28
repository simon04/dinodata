<template>
  <div class="dd-history">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <!-- scrolls horizontally: no line breaks in the table -->
    <div v-if="shown.length" class="dd-history-scroll">
      <table class="dd-history-table">
        <thead>
          <tr>
            <th scope="col">{{ t("history-date") }}</th>
            <th scope="col">{{ t("history-user") }}</th>
            <th scope="col">{{ t("history-change") }}</th>
            <th scope="col">{{ t("osm-comment") }}</th>
            <th scope="col">{{ t("osm-history-editor") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in shown" :key="row.version.version">
            <td class="dd-history-date">
              <a
                :href="versionUrl(osmRef, row.version.version)"
                target="_blank"
                rel="external noopener"
              >
                {{ formatDate(row.version.timestamp) }}
              </a>
            </td>
            <td>
              <a
                v-if="row.version.user"
                :href="`${OSM_URL}/user/${encodeURIComponent(row.version.user)}`"
                target="_blank"
                rel="external noopener"
              >
                {{ row.version.user }}
              </a>
            </td>
            <td class="dd-diff">
              <div
                v-for="(line, j) in row.lines"
                :key="j"
                :class="line.type === '+' ? 'dd-diff-add' : 'dd-diff-del'"
              >
                <span class="dd-diff-marker" aria-hidden="true">
                  {{ line.type }}
                </span>
                <component :is="line.type === '+' ? 'ins' : 'del'">
                  <code>{{ line.key }}={{ line.value }}</code>
                </component>
              </div>
              <span v-if="row.note" class="dd-history-comment">
                {{ row.note }}
              </span>
            </td>
            <td>
              <a
                :href="changesetUrl(row.version.changeset)"
                target="_blank"
                rel="external noopener"
              >
                {{
                  changesets[row.version.changeset]?.comment ??
                  row.version.changeset
                }}
              </a>
            </td>
            <td class="dd-history-tags">
              {{ changesets[row.version.changeset]?.created_by }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="dd-history-actions">
      <cdx-progress-indicator v-if="loading" show-label>
        {{ t("backlinks-loading") }}
      </cdx-progress-indicator>
      <cdx-button v-else-if="count < rows.length" @click="more">
        {{ t("backlinks-more") }}
      </cdx-button>
      <a
        :href="`${elementUrl(osmRef)}/history`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("osm-history-openstreetmap") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { CdxButton, CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { locale, t } from "../../i18n";
import {
  changesetUrl,
  elementUrl,
  geometryChanged,
  getChangesetTags,
  getHistory,
  OSM_URL,
  versionUrl,
  type OsmElement,
  type Tags,
} from "../../osm/osm";
import type { OsmRef } from "../../osm/osm-ref";
import { tagDiffLines } from "../../osm/tags";

/** Versions of an element with their tag changes, like the Wikidata history. */
const props = defineProps<{ osmRef: OsmRef; language: string }>();

const PAGE = 50;

const versions = shallowRef<OsmElement[]>([]);
const changesets = ref<Record<number, Tags>>({});
const count = ref(PAGE);
const loading = ref(false);
const error = ref<string>();

/** Tag changes of each version (newest first) against the one before. */
const rows = computed(() =>
  versions.value.map((version, i) => {
    const previous = versions.value[i + 1];
    const note =
      version.visible === false
        ? t("osm-history-deleted")
        : previous && previous.visible !== false
          ? geometryChanged(previous, version)
            ? t("osm-history-geometry")
            : undefined
          : undefined;
    return {
      version,
      lines: tagDiffLines(previous?.tags ?? {}, version.tags ?? {}),
      note,
    };
  }),
);
const shown = computed(() => rows.value.slice(0, count.value));

// the language is fixed, the component is recreated on changes
const dateFormat = new Intl.DateTimeFormat(locale(props.language), {
  dateStyle: "medium",
  timeStyle: "short",
});
const formatDate = (timestamp: string) =>
  dateFormat.format(new Date(timestamp));

/** Comments of the shown changesets not loaded yet. */
async function loadChangesets() {
  const ids = [
    ...new Set(shown.value.map((row) => row.version.changeset)),
  ].filter((id) => !(id in changesets.value));
  if (!ids.length) return;
  const tags = await getChangesetTags(ids);
  changesets.value = { ...changesets.value, ...tags };
}

async function load() {
  loading.value = true;
  try {
    versions.value = await getHistory(props.osmRef);
    await loadChangesets();
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function more() {
  count.value += PAGE;
  loading.value = true;
  try {
    await loadChangesets();
  } catch (e) {
    console.warn(e);
  } finally {
    loading.value = false;
  }
}

load();
</script>

<style scoped src="../history.css"></style>
