<template>
  <section class="dd-qs">
    <h2>{{ t("qs-title") }}</h2>
    <cdx-message v-if="!edits.length">
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
      <cdx-button action="progressive" weight="primary" @click="copy(commands)">
        <cdx-icon :icon="cdxIconCopy" />
        {{ copied ? t("qs-copied") : t("qs-copy") }}
      </cdx-button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { t } from "../i18n";
import { computed } from "vue";
import { CdxButton, CdxIcon, CdxMessage, CdxTextArea } from "@wikimedia/codex";
import { cdxIconCopy } from "@wikimedia/codex-icons";
import { useClipboard } from "@vueuse/core";
import { toQuickStatements, type Edit } from "../quickstatements";

const props = defineProps<{ id: string; edits: Edit[] }>();
const { copy, copied } = useClipboard();
const commands = computed(() => toQuickStatements(props.id, props.edits));
</script>

<style scoped>
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
