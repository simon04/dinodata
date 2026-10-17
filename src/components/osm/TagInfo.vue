<template>
  <div class="dd-tag-info">
    <div class="dd-tag-info-text">
      <p v-if="valueDoc?.description" class="dd-tag-info-description">
        {{ valueDoc.description }}
      </p>
      <p
        v-if="keyDoc?.description"
        :class="
          valueDoc?.description ? 'dd-tag-info-key' : 'dd-tag-info-description'
        "
      >
        <code>{{ tagKey }}</code>
        {{ keyDoc.description }}
      </p>
      <p v-if="!keyDoc && !valueDoc" class="dd-tag-info-key">
        {{ t("osm-doc-none") }}
      </p>
      <p v-if="statuses.length" class="dd-tag-info-status">
        <cdx-info-chip
          v-for="s in statuses"
          :key="s.label"
          :status="s.discouraged ? 'warning' : 'notice'"
        >
          {{ s.label }}
        </cdx-info-chip>
      </p>
      <p v-if="replacedBy.length" class="dd-tag-info-replaced">
        {{ t("osm-doc-replaced-by", replacedBy.join(", ")) }}
      </p>
      <p class="dd-tag-info-links">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :target="link.href.startsWith('#') ? undefined : '_blank'"
          rel="external noopener"
        >
          {{ link.label }}
        </a>
      </p>
    </div>
    <img
      v-if="image"
      class="dd-tag-info-image"
      :src="wikiImageUrl(image, 240)"
      alt=""
      loading="lazy"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CdxInfoChip } from "@wikimedia/codex";
import { t } from "../../i18n";
import {
  keyPage,
  tagPage,
  wikiImageUrl,
  wikiUrl,
  type TagDoc,
} from "../../osm/osmwiki";

/** Documentation of a tag from the OSM wiki: meaning, status, image, links. */
const props = defineProps<{
  tagKey: string;
  value?: string;
  keyDoc?: TagDoc;
  valueDoc?: TagDoc;
  /** labels of OSM wiki items (statuses, tags) */
  itemLabels: Record<string, string>;
}>();

const statuses = computed(() =>
  [props.valueDoc, props.keyDoc].flatMap((doc) =>
    doc?.status
      ? [
          {
            label: `${doc === props.valueDoc ? `${props.tagKey}=${props.value}` : props.tagKey}: ${props.itemLabels[doc.status] ?? doc.status}`,
            discouraged: doc.discouraged,
          },
        ]
      : [],
  ),
);

const replacedBy = computed(() =>
  [
    ...(props.valueDoc?.replacedBy ?? []),
    ...(props.keyDoc?.replacedBy ?? []),
  ].map((id) => props.itemLabels[id] ?? id),
);

const image = computed(() => props.valueDoc?.image ?? props.keyDoc?.image);

const links = computed(() => {
  const result: { href: string; label: string }[] = [];
  const page = (doc: TagDoc | undefined, fallback: string) =>
    wikiUrl(doc?.localPage ?? doc?.page ?? fallback);
  if (props.value && props.valueDoc)
    result.push({
      href: page(props.valueDoc, tagPage(props.tagKey, props.value)),
      label: t("osm-doc-wiki", `${props.tagKey}=${props.value}`),
    });
  result.push({
    href: page(props.keyDoc, keyPage(props.tagKey)),
    label: t("osm-doc-wiki", props.tagKey),
  });
  const formatter = props.keyDoc?.formatterUrl;
  if (formatter && props.value)
    result.push({
      href: formatter.replace("$1", encodeURIComponent(props.value)),
      label: new URL(formatter.replace("$1", "x")).hostname,
    });
  const wikidata = props.valueDoc?.wikidata ?? props.keyDoc?.wikidata;
  if (wikidata)
    result.push({ href: `#${wikidata}`, label: `Wikidata ${wikidata}` });
  result.push({
    href: `https://taginfo.openstreetmap.org/keys/${encodeURIComponent(props.tagKey)}`,
    label: "taginfo",
  });
  return result;
});
</script>

<style scoped>
.dd-tag-info {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.dd-tag-info-text {
  flex: 1;
  min-width: 0;
}
.dd-tag-info p {
  margin: 0 0 0.5rem;
}
.dd-tag-info-description {
  font-size: 1.05em;
}
.dd-tag-info-key {
  color: var(--color-subtle);
  font-size: 0.875em;
}
.dd-tag-info-key code {
  margin-inline-end: 0.25rem;
}
.dd-tag-info-status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.dd-tag-info-replaced {
  color: var(--color-warning);
  font-weight: bold;
}
.dd-tag-info-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.875em;
}
.dd-tag-info-image {
  width: 6rem;
  max-height: 6rem;
  object-fit: cover;
  border-radius: var(--border-radius-base);
}
</style>
