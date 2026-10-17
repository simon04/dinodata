<template>
  <section v-if="issues.length" class="dd-osm-issues">
    <h2>{{ t("osm-issues", issues.length) }}</h2>
    <cdx-message
      v-for="(issue, i) in issues"
      :key="i"
      :type="issue.severity === 'notice' ? 'notice' : issue.severity"
    >
      <span class="dd-osm-issue">
        <span>{{ t(issue.message, ...issue.params) }}</span>
        <span class="dd-osm-issue-actions">
          <cdx-button
            v-if="issue.fix"
            size="small"
            action="progressive"
            @click="emit('fix', issue.fix)"
          >
            {{ t("osm-issue-fix") }}
          </cdx-button>
          <cdx-button
            size="small"
            weight="quiet"
            @click="emit('info', issue.key)"
          >
            {{ t("osm-issue-info") }}
          </cdx-button>
        </span>
      </span>
    </cdx-message>
  </section>
</template>

<script setup lang="ts">
import { CdxButton, CdxMessage } from "@wikimedia/codex";
import { t } from "../../i18n";
import type { TagPatch } from "../../osm/tags";
import type { Issue } from "../../osm/validate";

/** Issues of the tags, with one-tap fixes. */
defineProps<{ issues: Issue[] }>();
const emit = defineEmits<{ fix: [patch: TagPatch]; info: [key: string] }>();
</script>

<style scoped>
.dd-osm-issues h2 {
  font-size: 1.1em;
  margin: 1rem 0 0.5rem;
}
.dd-osm-issues .cdx-message + .cdx-message {
  margin-top: 0.5rem;
}
.dd-osm-issue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.dd-osm-issue-actions {
  display: flex;
  gap: 0.25rem;
}
</style>
