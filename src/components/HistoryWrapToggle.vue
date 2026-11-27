<template>
  <p class="dd-history-wrap-toggle">
    <cdx-checkbox v-model="historyWrap" :inline="true">
      {{ t("history-wrap") }}
    </cdx-checkbox>
  </p>
</template>

<script setup lang="ts">
import { CdxCheckbox } from "@wikimedia/codex";
import { t } from "../i18n";
import { historyWrap } from "./history-wrap";
</script>

<style scoped>
.dd-history-wrap-toggle {
  display: flex;
  justify-content: flex-end;
  margin-block: 0 0.5rem;
}
</style>
