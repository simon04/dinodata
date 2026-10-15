<template>
  <table class="dd-table dd-terms-table">
    <caption>{{ t("terms-caption") }}</caption>
    <thead>
      <tr>
        <th>{{ t("terms-language") }}</th>
        <th>{{ t("terms-label") }}</th>
        <th>{{ t("terms-description") }}</th>
        <th>{{ t("terms-aliases") }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.language">
        <td>
          <code>{{ row.language }}</code>
        </td>
        <td :class="{ 'dd-changed': row.labelChanged }">
          <EditableText
            :model-value="row.label"
            @update:model-value="setTerm('label', row.language, $event)"
          />
        </td>
        <td :class="{ 'dd-changed': row.descriptionChanged }">
          <EditableText
            :model-value="row.description"
            @update:model-value="setTerm('description', row.language, $event)"
          />
        </td>
        <td>
          <div class="dd-aliases">
            <span
              v-for="alias in row.aliases"
              :key="alias.value"
              class="dd-alias"
              :class="{
                'dd-added': alias.added,
                'dd-removed': alias.removed,
              }"
            >
              {{ alias.value }}
              <button
                class="dd-alias-action"
                :title="alias.added || alias.removed ? t('undo') : t('remove')"
                @click="toggleAlias(row.language, alias.value, alias)"
              >
                {{ alias.added || alias.removed ? "↺" : "×" }}
              </button>
            </span>
            <EditableText
              class="dd-alias-new"
              model-value=""
              @update:model-value="addAlias(row.language, $event)"
            >
              +
            </EditableText>
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="4">
          <cdx-text-input
            v-model="newLanguage"
            class="dd-new-language"
            :placeholder="t('terms-placeholder-language')"
            @keydown.enter="addLanguage"
          />
          <cdx-button :disabled="!newLanguage.trim()" @click="addLanguage">
            <cdx-icon :icon="cdxIconAdd" />
            {{ t("add-label") }}
          </cdx-button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CdxButton, CdxIcon, CdxTextInput } from "@wikimedia/codex";
import { cdxIconAdd } from "@wikimedia/codex-icons";
import { t } from "../i18n";
import type { Edit } from "../quickstatements";
import type { Entity } from "../wikidata";
import EditableText from "./EditableText.vue";

const props = defineProps<{ entity: Entity; language: string }>();
const edits = defineModel<Edit[]>("edits", { required: true });

const extraLanguages = ref<string[]>([]);
const newLanguage = ref("");

type TermEdit = Extract<Edit, { type: "label" | "description" }>;
type AliasEdit = Extract<Edit, { type: "alias" }>;

function termEdit(type: "label" | "description", language: string) {
  return edits.value.find(
    (e): e is TermEdit => e.type === type && e.language === language,
  );
}

function rank(language: string): number {
  if (language === props.language) return 0;
  if (extraLanguages.value.includes(language)) return 1;
  return 2;
}

const rows = computed(() => {
  const e = props.entity;
  const fromEdits = edits.value.flatMap((x) =>
    x.type === "label" || x.type === "description" || x.type === "alias"
      ? [x.language]
      : [],
  );
  const languages = new Set([
    ...Object.keys(e.labels),
    ...Object.keys(e.descriptions),
    ...Object.keys(e.aliases),
    ...fromEdits,
    ...extraLanguages.value,
  ]);
  return (
    [...languages]
      // user language first, then added languages, then the rest
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map((language) => {
        const label = termEdit("label", language);
        const description = termEdit("description", language);
        const aliasEdits = edits.value.filter(
          (x): x is AliasEdit => x.type === "alias" && x.language === language,
        );
        const original = e.aliases[language]?.map((a) => a.value) ?? [];
        return {
          language,
          label: label?.value ?? e.labels[language]?.value ?? "",
          labelChanged: !!label,
          description:
            description?.value ?? e.descriptions[language]?.value ?? "",
          descriptionChanged: !!description,
          aliases: [
            ...original.map((value) => ({
              value,
              added: false,
              removed: aliasEdits.some((x) => x.remove && x.value === value),
            })),
            ...aliasEdits
              .filter((x) => !x.remove)
              .map((x) => ({ value: x.value, added: true, removed: false })),
          ],
        };
      })
  );
});

function setTerm(
  type: "label" | "description",
  language: string,
  value: string,
) {
  const original =
    (type === "label" ? props.entity.labels : props.entity.descriptions)[
      language
    ]?.value ?? "";
  const rest = edits.value.filter(
    (e) => !(e.type === type && e.language === language),
  );
  edits.value =
    value === original ? rest : [...rest, { type, language, value }];
}

function addAlias(language: string, value: string) {
  if (!value) return;
  edits.value = [...edits.value, { type: "alias", language, value }];
}

function toggleAlias(
  language: string,
  value: string,
  state: { added: boolean; removed: boolean },
) {
  const matches = (e: Edit) =>
    e.type === "alias" && e.language === language && e.value === value;
  edits.value =
    state.added || state.removed
      ? edits.value.filter((e) => !matches(e))
      : [...edits.value, { type: "alias", language, value, remove: true }];
}

function addLanguage() {
  const code = newLanguage.value.trim().toLowerCase();
  if (!code) return;
  if (!extraLanguages.value.includes(code)) extraLanguages.value.push(code);
  newLanguage.value = "";
}
</script>

<style scoped>
.dd-new-language {
  display: inline-block;
  width: 16rem;
  min-width: 16rem;
  margin-inline-end: 0.5rem;
}
.dd-aliases {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}
.dd-alias {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.375rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-pill);
}
.dd-alias-action {
  all: unset;
  cursor: pointer;
  color: var(--color-subtle);
}
.dd-alias-action:hover {
  color: var(--color-destructive);
}
.dd-alias-new {
  width: auto;
  min-width: 1.5rem;
  color: var(--color-progressive);
  text-align: center;
}
.dd-added {
  background: var(--background-color-success-subtle);
}
.dd-removed {
  background: var(--background-color-error-subtle);
  text-decoration: line-through;
}
</style>
