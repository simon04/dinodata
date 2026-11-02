<template>
  <section class="dd-qs">
    <h2>{{ t("qs-title") }}</h2>
    <cdx-message v-if="savedRevision && !edits.length" type="success">
      {{ t("save-done") }}
      <a
        :href="`https://www.wikidata.org/w/index.php?diff=${savedRevision}`"
        target="_blank"
        rel="external noopener"
      >
        {{ t("save-diff") }}
      </a>
    </cdx-message>
    <p v-else-if="!edits.length" class="dd-qs-empty">
      <template
        v-for="(part, i) in t('qs-empty', '\u0000').split('\u0000')"
        :key="i"
      >
        <a
          v-if="i"
          href="https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation/User_guide"
          target="_blank"
          rel="external noopener"
        >
          QuickStatements 3.0
        </a>
        {{ part }}
      </template>
    </p>
    <template v-else>
      <!-- the changes as in the history, the commands only via copying -->
      <div class="dd-qs-diff">
        <DiffLines
          :id="id"
          :lines="diff"
          :labels="allLabels"
          :descriptions="allDescriptions"
        />
      </div>
      <div class="dd-qs-actions">
        <template v-if="username">
          <cdx-text-input
            v-model="summary"
            class="dd-qs-summary"
            :placeholder="t('save-summary')"
            :aria-label="t('save-summary')"
            :disabled="saving"
            @keydown.enter="save"
          />
          <cdx-button
            action="progressive"
            weight="primary"
            :disabled="saving"
            @click="save"
          >
            <cdx-icon :icon="cdxIconUpload" />
            {{ t("save") }}
          </cdx-button>
        </template>
        <cdx-button v-else-if="loginAvailable" weight="quiet" @click="login">
          <cdx-icon :icon="cdxIconLogIn" />
          {{ t("save-login") }}
        </cdx-button>
        <cdx-button
          :action="username ? 'default' : 'progressive'"
          :weight="username ? 'normal' : 'primary'"
          @click="copy"
        >
          <cdx-icon :icon="cdxIconCopy" />
          {{ t("qs-copy") }}
        </cdx-button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed, ref, watch } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxMessage,
  CdxTextInput,
  useToast,
} from "@wikimedia/codex";
import {
  cdxIconCopy,
  cdxIconLogIn,
  cdxIconUpload,
} from "@wikimedia/codex-icons";
import { loginAvailable, useAuth } from "../auth";
import { useSharedClipboard } from "../clipboard";
import { applyEdits } from "../edit";
import { entityDiff, tokenize } from "../history";
import { toQuickStatements, type Edit } from "../quickstatements";
import { getLabels, type Entity } from "../wikidata";
import DiffLines from "./DiffLines.vue";

const props = defineProps<{
  id: string;
  entity: Entity;
  edits: Edit[];
  language: string;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  saving?: boolean;
  /** revision of the last save, for the diff link */
  savedRevision?: number;
}>();
const emit = defineEmits<{ save: [summary: string] }>();
const { username, login } = useAuth();
const summary = ref("");

function save() {
  emit("save", summary.value.trim());
}
const toast = useToast();
const clipboard = useSharedClipboard();
const commands = computed(() => toQuickStatements(props.id, props.edits));

/** The pending changes, like a revision in the history. */
const diff = computed(() => {
  try {
    return entityDiff(props.entity, applyEdits(props.entity, props.edits));
  } catch (e) {
    // e.g. a changed statement no longer in the entity
    console.warn(e);
    return [];
  }
});

// labels of IDs the item view has not loaded, e.g. of removed references
const labels = ref<Record<string, string>>({});
const descriptions = ref<Record<string, string>>({});
const allLabels = computed(() => ({ ...labels.value, ...props.labels }));
const allDescriptions = computed(() => ({
  ...descriptions.value,
  ...props.descriptions,
}));
watch(diff, (lines) => {
  const missing = [
    ...new Set(
      lines.flatMap((l) => tokenize(l.text).flatMap((p) => p.id ?? [])),
    ),
  ].filter((id) => !(id in allLabels.value));
  if (!missing.length) return;
  for (const id of missing) labels.value[id] = id;
  getLabels(missing, props.language, (l, d) => {
    labels.value = { ...labels.value, ...l };
    descriptions.value = { ...descriptions.value, ...d };
  }).catch(console.warn);
});

async function copy() {
  await clipboard.copy(commands.value);
  toast.success(t("qs-copied"), { autoDismiss: true });
}
</script>

<style scoped>
.dd-qs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.dd-qs-summary {
  flex: 1;
  min-width: 16rem;
  max-width: 40rem;
}
.dd-qs {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color-subtle);
}
/* a hint, not a notice */
.dd-qs-empty {
  margin: 0;
  color: var(--color-subtle);
}
/* scrolls horizontally: no line breaks, as in the history */
.dd-qs-diff {
  overflow: auto;
  max-height: 20rem;
  white-space: nowrap;
}
</style>
