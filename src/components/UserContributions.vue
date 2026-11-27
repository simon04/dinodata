<template>
  <section class="dd-history dd-contributions">
    <h1>{{ t("contributions-title", user) }}</h1>
    <p class="dd-contributions-links">
      <a :href="userPage" target="_blank" rel="external noopener">
        {{ t("contributions-user-page") }}
      </a>
      <a :href="wikidataContributions" target="_blank" rel="external noopener">
        {{ t("contributions-wikidata") }}
      </a>
    </p>
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <p v-else-if="!loading && !contributions.length">
      {{ t("contributions-none") }}
    </p>
    <HistoryWrapToggle v-if="contributions.length" />
    <!-- scrolls horizontally, unless long lines are wrapped -->
    <div
      v-if="contributions.length"
      :class="['dd-history-scroll', { 'dd-history-wrap': historyWrap }]"
    >
      <table class="dd-history-table">
        <thead>
          <tr>
            <th scope="col">{{ t("history-date") }}</th>
            <th scope="col">{{ t("contributions-item") }}</th>
            <th scope="col">{{ t("history-change") }}</th>
            <th scope="col">{{ t("history-tag") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in contributions" :key="c.revid">
            <td class="dd-history-date">
              <a
                :href="`https://www.wikidata.org/w/index.php?diff=${c.revid}&oldid=${c.parentid}`"
                target="_blank"
                rel="external noopener"
              >
                {{ formatDate(c.timestamp) }}
              </a>
            </td>
            <td>
              <a :href="`#${c.id}`" v-tooltip="descriptions[c.id]">
                {{ labels[c.id] ?? c.id }}
              </a>
              <code class="dd-id-chip">{{ c.id }}</code>
            </td>
            <td class="dd-history-diff">
              <template v-if="diffs[c.revid]">
                <DiffLines
                  :id="c.id"
                  :lines="diffs[c.revid]!"
                  :labels="labels"
                  :descriptions="descriptions"
                />
                <span v-if="!diffs[c.revid]!.length" class="dd-history-comment">
                  {{ c.comment }}
                </span>
              </template>
              <cdx-progress-indicator v-else>
                {{ t("backlinks-loading") }}
              </cdx-progress-indicator>
            </td>
            <td class="dd-history-tags">
              {{ c.tags.map((tag) => tagNames[tag] ?? tag).join(", ") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="dd-history-actions">
      <cdx-progress-indicator v-if="loading" show-label>
        {{ t("backlinks-loading") }}
      </cdx-progress-indicator>
      <cdx-button v-else-if="next" @click="load">
        {{ t("backlinks-more") }}
      </cdx-button>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useTitle } from "@vueuse/core";
import { CdxButton, CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { locale, t } from "../i18n";
import {
  entityDiff,
  getContributions,
  getRevisionEntities,
  getTagNames,
  tokenize,
  type Contribution,
  type DiffLine,
} from "../history";
import { getLabels, type Entity } from "../wikidata";
import DiffLines from "./DiffLines.vue";
import HistoryWrapToggle from "./HistoryWrapToggle.vue";
import { historyWrap } from "./history-wrap";

/**
 * `#contributions/Name`: the edits of a user to items, properties and
 * lexemes, each as QuickStatements lines like the history of an item.
 */
const props = defineProps<{ user: string; language: string }>();

useTitle(() => `${t("contributions-title", props.user)} · DinoData`);

const contributions = ref<Omit<Contribution, "entity">[]>([]);
/** entities of the loaded revisions and their parents, null if hidden */
const entities = ref<Record<number, Entity | null>>({});
const tagNames = ref<Record<string, string>>({});
const labels = ref<Record<string, string>>({});
const descriptions = ref<Record<string, string>>({});
const next = ref<Record<string, string>>();
const loading = ref(false);
const error = ref<string>();

const userTitle = computed(() => props.user.replace(/ /g, "_"));
const userPage = computed(
  () =>
    `https://www.wikidata.org/wiki/User:${encodeURIComponent(userTitle.value)}`,
);
const wikidataContributions = computed(
  () =>
    `https://www.wikidata.org/wiki/Special:Contributions/${encodeURIComponent(userTitle.value)}`,
);

/** Changes of each edit against its parent, once both are loaded. */
const diffs = computed(() => {
  const result: Record<number, DiffLine[]> = {};
  for (const c of contributions.value) {
    if (!(c.revid in entities.value)) continue;
    if (c.parentid && !(c.parentid in entities.value)) continue;
    const after = entities.value[c.revid];
    const before = c.parentid ? entities.value[c.parentid] : undefined;
    // hidden or unavailable content: the comment instead
    result[c.revid] =
      before === null || !after ? [] : entityDiff(before, after);
  }
  return result;
});

// labels and descriptions of the edited entities and the IDs in the diffs
watch(diffs, (all) => {
  const ids = new Set([
    ...contributions.value.map((c) => c.id),
    ...Object.values(all)
      .flat()
      .flatMap((line) => tokenize(line.text).flatMap((p) => p.id ?? [])),
  ]);
  const missing = [...ids].filter((id) => !(id in labels.value));
  for (const id of missing) labels.value[id] = id;
  if (!missing.length) return;
  getLabels(missing, props.language, (l, d) => {
    labels.value = { ...labels.value, ...l };
    descriptions.value = { ...descriptions.value, ...d };
  }).catch(console.warn);
});

// the language is fixed, the component is recreated on changes
const dateFormat = new Intl.DateTimeFormat(locale(props.language), {
  dateStyle: "medium",
  timeStyle: "short",
});
const formatDate = (timestamp: string) =>
  dateFormat.format(new Date(timestamp));

async function load() {
  loading.value = true;
  try {
    const result = await getContributions(props.user, next.value);
    contributions.value.push(...result.contributions);
    next.value = result.next;
    const unknown = [
      ...new Set(result.contributions.flatMap((c) => c.tags)),
    ].filter((tag) => !(tag in tagNames.value));
    getTagNames(unknown, props.language)
      .then((names) => (tagNames.value = { ...tagNames.value, ...names }))
      .catch(console.warn);
    // each edit and its parent, often the previous edit of the same user
    const revids = [
      ...new Set(
        result.contributions.flatMap((c) =>
          c.parentid ? [c.revid, c.parentid] : [c.revid],
        ),
      ),
    ].filter((revid) => !(revid in entities.value));
    getRevisionEntities(revids)
      .then((e) => (entities.value = { ...entities.value, ...e }))
      .catch((e) => {
        console.warn(e);
        for (const revid of revids) entities.value[revid] ??= null;
      });
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}
load();
</script>

<style scoped src="./history.css"></style>

<style scoped>
.dd-contributions h1 {
  font-size: 1.25rem;
}
.dd-contributions-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
</style>
