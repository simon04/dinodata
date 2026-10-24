<template>
  <div class="dd-history">
    <cdx-message v-if="error" type="error">{{ error }}</cdx-message>
    <!-- scrolls horizontally: no line breaks in the table -->
    <div v-if="revisions.length" class="dd-history-scroll">
      <table class="dd-history-table">
        <thead>
          <tr>
            <th scope="col">{{ t("history-date") }}</th>
            <th scope="col">{{ t("history-user") }}</th>
            <th scope="col">{{ t("history-change") }}</th>
            <th scope="col">{{ t("history-tag") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rev in revisions" :key="rev.revid">
            <td class="dd-history-date">
              <a
                :href="`https://www.wikidata.org/w/index.php?diff=${rev.revid}&oldid=${rev.parentid}`"
                target="_blank"
                rel="external noopener"
              >
                {{ formatDate(rev.timestamp) }}
              </a>
            </td>
            <td>
              <a
                v-if="rev.user"
                :href="userUrl(rev)"
                target="_blank"
                rel="external noopener"
              >
                {{ rev.user }}
              </a>
            </td>
            <td class="dd-diff">
              <template v-if="diffs[rev.revid]">
                <div
                  v-for="(line, j) in diffs[rev.revid]"
                  :key="j"
                  :class="line.type === '+' ? 'dd-diff-add' : 'dd-diff-del'"
                >
                  <span class="dd-diff-marker" aria-hidden="true">
                    {{ line.type }}
                  </span>
                  <component :is="line.type === '+' ? 'ins' : 'del'">
                    <template v-for="(part, k) in tokenize(line.text)" :key="k">
                      <!-- the item itself (starting each line) just by ID -->
                      <code v-if="!part.id || part.id === id">
                        {{ part.text }}
                      </code>
                      <span v-else class="dd-diff-entity">
                        <a
                          :href="`#${part.id}`"
                          v-tooltip="descriptions[part.id]"
                        >
                          {{ labels[part.id] ?? part.id }}
                        </a>
                        <code class="dd-id-chip">{{ part.text }}</code>
                      </span>
                    </template>
                  </component>
                </div>
                <span
                  v-if="!diffs[rev.revid]!.length"
                  class="dd-history-comment"
                >
                  {{ rev.comment }}
                </span>
              </template>
              <cdx-progress-indicator v-else>
                {{ t("backlinks-loading") }}
              </cdx-progress-indicator>
            </td>
            <td class="dd-history-tags">
              {{ rev.tags.map((tag) => tagNames[tag] ?? tag).join(", ") }}
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
      <a
        :href="`https://www.wikidata.org/w/index.php?title=${encodeURIComponent(title)}&action=history`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("history-wikidata") }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { CdxButton, CdxMessage, CdxProgressIndicator } from "@wikimedia/codex";
import { locale, t } from "../i18n";
import {
  entityDiff,
  getRevisionEntity,
  getRevisions,
  getTagNames,
  tokenize,
  type DiffLine,
  type Revision,
} from "../history";
import { getLabels, type Entity } from "../wikidata";

const props = defineProps<{ id: string; language: string }>();

const PREFIXES: Record<string, string> = { P: "Property:", L: "Lexeme:" };
const title = computed(() => `${PREFIXES[props.id[0]] ?? ""}${props.id}`);

const revisions = ref<Revision[]>([]);
/** entities of parent revisions not in the list (before the oldest loaded) */
const parents = ref<Record<number, Entity | null>>({});
const tagNames = ref<Record<string, string>>({});
const labels = ref<Record<string, string>>({});
const descriptions = ref<Record<string, string>>({});
const next = ref<Record<string, string>>();
const loading = ref(false);
const error = ref<string>();

/** Changes of each revision against its parent, once that is known. */
const diffs = computed(() => {
  const result: Record<number, DiffLine[]> = {};
  revisions.value.forEach((rev, i) => {
    const previous = revisions.value[i + 1];
    const parent = !rev.parentid
      ? undefined
      : previous?.revid === rev.parentid
        ? previous.entity
        : parents.value[rev.parentid];
    // parent still loading
    if (
      parent === undefined &&
      rev.parentid &&
      !(rev.parentid in parents.value)
    )
      return;
    // hidden or unavailable content: the comment instead
    result[rev.revid] =
      parent === null || !rev.entity ? [] : entityDiff(parent, rev.entity);
  });
  return result;
});

// labels and descriptions of the IDs in the diffs, for tooltips
watch(diffs, (all) => {
  const ids = new Set(
    Object.values(all)
      .flat()
      .flatMap((line) => tokenize(line.text).flatMap((p) => p.id ?? [])),
  );
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

const userUrl = (rev: Revision) =>
  rev.anon
    ? `https://www.wikidata.org/wiki/Special:Contributions/${encodeURIComponent(rev.user!)}`
    : `https://www.wikidata.org/wiki/User:${encodeURIComponent(rev.user!.replace(/ /g, "_"))}`;

async function load() {
  loading.value = true;
  try {
    const result = await getRevisions(title.value, next.value);
    revisions.value.push(...result.revisions);
    next.value = result.next;
    const unknown = [
      ...new Set(result.revisions.flatMap((r) => r.tags)),
    ].filter((tag) => !(tag in tagNames.value));
    getTagNames(unknown, props.language)
      .then((names) => (tagNames.value = { ...tagNames.value, ...names }))
      .catch(console.warn);
    // the parent of the oldest revision, unless the next page is loaded first
    const oldest = result.revisions[result.revisions.length - 1];
    if (oldest?.parentid)
      getRevisionEntity(oldest.parentid)
        .then((e) => (parents.value[oldest.parentid] = e ?? null))
        .catch((e) => {
          console.warn(e);
          parents.value[oldest.parentid] = null;
        });
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}
load();
</script>

<style scoped>
.dd-history-scroll {
  overflow-x: auto;
}
.dd-history-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}
.dd-history-table th,
.dd-history-table td {
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--border-color-subtle);
  text-align: start;
  vertical-align: top;
}
.dd-history-table thead th {
  border-bottom-color: var(--border-color-base);
}
.dd-history-tags,
.dd-history-comment {
  color: var(--color-subtle);
}
.dd-diff {
  width: 100%;
}
.dd-diff-add,
.dd-diff-del {
  /* the background also behind long lines */
  min-width: 100%;
  width: max-content;
  display: flex;
  gap: 0.5rem;
  padding-inline: 0.25rem;
  line-height: 1.6;
}
.dd-diff-add {
  background: var(--background-color-success-subtle);
}
.dd-diff-del {
  background: var(--background-color-error-subtle);
}
/* flex: no whitespace between the parts of a line */
.dd-diff-add ins,
.dd-diff-del del {
  display: flex;
  align-items: baseline;
  text-decoration: none;
}
.dd-diff-marker {
  flex: none;
  font-family: monospace;
  user-select: none;
}
/* QuickStatements syntax without the code boxes of the skin */
.dd-diff code:not(.dd-id-chip) {
  padding: 0;
  border: 0;
  background: none;
  white-space: pre;
}
.dd-diff-entity {
  display: inline-flex;
  align-items: baseline;
}
.dd-history-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
