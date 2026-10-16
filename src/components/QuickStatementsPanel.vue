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
    <cdx-message v-else-if="!edits.length">
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
    </cdx-message>
    <template v-else>
      <cdx-text-area :model-value="commands" readonly rows="6" />
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
import { computed, ref } from "vue";
import {
  CdxButton,
  CdxIcon,
  CdxMessage,
  CdxTextArea,
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
import { toQuickStatements, type Edit } from "../quickstatements";

const props = defineProps<{
  id: string;
  edits: Edit[];
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
.dd-qs .cdx-text-area {
  font-family: monospace;
  margin-bottom: 0.5rem;
}
</style>
