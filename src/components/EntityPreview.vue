<template>
  <Teleport to="body">
    <a
      v-if="preview"
      ref="card"
      class="dd-preview"
      :class="{ 'dd-preview--portrait': portrait }"
      :href="`#${preview.id}`"
      :style="position"
      tabindex="-1"
      aria-hidden="true"
      @pointerenter="stop"
      @pointerleave="hideSoon"
    >
      <img
        v-if="preview.image"
        class="dd-preview__image"
        :src="preview.image.url"
        alt=""
      />
      <div class="dd-preview__text">
        <strong>{{ preview.label ?? preview.id }}</strong>
        <span v-if="preview.description" class="dd-preview__description">
          {{ preview.description }}
        </span>
        <p
          v-if="preview.extract"
          :lang="preview.extract.lang"
          :dir="preview.extract.dir"
        >
          {{ preview.extract.text }}
        </p>
      </div>
    </a>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useEventListener } from "@vueuse/core";
import { language } from "../i18n";
import { getPreview, previewTarget, type Preview } from "../preview";

/** the pointer has to rest this long on a link before the preview appears */
const SHOW_DELAY = 500;
/** time to move the pointer from the link into the preview */
const HIDE_DELAY = 300;
const GAP = 8;

const preview = ref<Preview>();
const position = ref<Record<string, string>>({});
const card = useTemplateRef<HTMLElement>("card");
const portrait = computed(
  () =>
    preview.value?.image &&
    preview.value.image.height > preview.value.image.width,
);

let link: HTMLAnchorElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const stop = () => clearTimeout(timer);

function hide() {
  stop();
  link = undefined;
  preview.value = undefined;
}
function hideSoon() {
  stop();
  timer = setTimeout(hide, HIDE_DELAY);
}

async function show(target: HTMLAnchorElement, id: string) {
  link = target;
  const p = await getPreview(id, language.value).catch(console.warn);
  if (!p || link !== target || !target.isConnected) return;
  // measured invisibly, then placed below the link, or above if it fits better
  position.value = { visibility: "hidden" };
  preview.value = p;
  await nextTick();
  if (!card.value || link !== target) return;
  const rect = target.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = card.value;
  const above =
    rect.bottom + GAP + height > innerHeight && rect.top - GAP - height > 0;
  const top = above ? rect.top - GAP - height : rect.bottom + GAP;
  const start = document.dir === "rtl" ? rect.right - width : rect.left;
  const left = Math.max(GAP, Math.min(start, innerWidth - width - GAP));
  position.value = {
    top: `${top + scrollY}px`,
    left: `${left + scrollX}px`,
  };
}

useEventListener(document, "pointerover", (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return;
  const target = previewTarget(e.target);
  if (!target) return;
  stop();
  if (target.link === link) return;
  hide();
  timer = setTimeout(() => show(target.link, target.id), SHOW_DELAY);
});
useEventListener(document, "pointerout", (e: PointerEvent) => {
  const target = previewTarget(e.target);
  if (!target || target.link.contains(e.relatedTarget as Node | null)) return;
  if (target.link === link) hideSoon();
  else stop();
});
useEventListener(document, "focusin", (e: FocusEvent) => {
  const target = previewTarget(e.target);
  if (target && (e.target as Element).matches(":focus-visible")) {
    stop();
    show(target.link, target.id);
  }
});
useEventListener(document, "focusout", (e: FocusEvent) => {
  if (previewTarget(e.target)?.link === link) hide();
});
useEventListener(document, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") hide();
});
useEventListener(document, "click", hide);
useEventListener(window, "hashchange", hide);
</script>

<style>
.dd-preview {
  position: absolute;
  z-index: 450;
  display: flex;
  flex-direction: column;
  width: 320px;
  overflow: hidden;
  background: var(--background-color-base);
  color: var(--color-base);
  border: 1px solid var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  box-shadow: var(--box-shadow-drop-medium);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}
.dd-preview:hover {
  text-decoration: none;
  color: var(--color-base);
}
.dd-preview--portrait {
  flex-direction: row-reverse;
  width: 450px;
}
.dd-preview__image {
  flex: none;
  width: 100%;
  height: 180px;
  object-fit: cover;
}
.dd-preview--portrait .dd-preview__image {
  width: 200px;
  height: auto;
  max-height: 250px;
}
.dd-preview__text {
  flex: 1;
  min-width: 0;
  padding: 12px 16px;
}
.dd-preview__description {
  display: block;
  color: var(--color-subtle);
}
.dd-preview__text p {
  margin: 0.5em 0 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
}
.dd-preview--portrait .dd-preview__text p {
  -webkit-line-clamp: 8;
}
</style>
