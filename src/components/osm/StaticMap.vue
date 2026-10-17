<template>
  <a
    class="dd-static-map"
    :href="href"
    target="_blank"
    rel="external noopener"
    :aria-label="t('osm-map-open')"
  >
    <img
      v-for="tile in tiles"
      :key="tile.src"
      :src="tile.src"
      alt=""
      loading="lazy"
      :style="{ left: `calc(50% + ${tile.left}px)`, top: `${tile.top}px` }"
    />
    <span
      v-if="box"
      class="dd-static-map-box"
      :style="{
        left: `calc(50% + ${box.left}px)`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }"
    />
    <span v-else class="dd-static-map-marker" />
    <span class="dd-static-map-attribution">© OpenStreetMap</span>
  </a>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../i18n";
import type { Bounds } from "../../osm/geocoding";

/**
 * Non-interactive map preview from OSM tiles: the location of a node, or the
 * bounding box of a way or relation.
 */
const props = defineProps<{ bounds: Bounds; href: string }>();

const TILE = 256;
/** widest rendering, tiles are positioned relative to the center */
const MAX_WIDTH = 720;
const HEIGHT = 160;

/** Web Mercator: world pixel coordinates at zoom z */
function project(lat: number, lon: number, z: number) {
  const size = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

const view = computed(() => {
  const { minlat, minlon, maxlat, maxlon } = props.bounds;
  // largest zoom where the box fits in a 300 × 140 px area
  let z = 18;
  while (z > 1) {
    const a = project(maxlat, minlon, z);
    const b = project(minlat, maxlon, z);
    if (b.x - a.x <= 300 && b.y - a.y <= HEIGHT - 20) break;
    z--;
  }
  const a = project(maxlat, minlon, z);
  const b = project(minlat, maxlon, z);
  return { z, a, b, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
});

const tiles = computed(() => {
  const { z, cx, cy } = view.value;
  const n = 2 ** z;
  const result = [];
  for (
    let tx = Math.floor((cx - MAX_WIDTH / 2) / TILE);
    tx <= Math.floor((cx + MAX_WIDTH / 2) / TILE);
    tx++
  )
    for (
      let ty = Math.floor((cy - HEIGHT / 2) / TILE);
      ty <= Math.floor((cy + HEIGHT / 2) / TILE);
      ty++
    ) {
      if (ty < 0 || ty >= n) continue;
      const x = ((tx % n) + n) % n;
      result.push({
        src: `https://tile.openstreetmap.org/${z}/${x}/${ty}.png`,
        left: tx * TILE - cx,
        top: ty * TILE - cy + HEIGHT / 2,
      });
    }
  return result;
});

/** box for ways and relations, a marker for points */
const box = computed(() => {
  const { a, b, cx, cy } = view.value;
  const width = b.x - a.x;
  const height = b.y - a.y;
  if (width < 6 && height < 6) return undefined;
  return {
    left: a.x - cx,
    top: a.y - cy + HEIGHT / 2,
    width,
    height,
  };
});
</script>

<style scoped>
.dd-static-map {
  position: relative;
  display: block;
  height: 160px;
  overflow: hidden;
  border-radius: var(--border-radius-base);
  border: 1px solid var(--border-color-subtle);
  background: var(--background-color-neutral-subtle);
}
.dd-static-map img {
  position: absolute;
  width: 256px;
  height: 256px;
}
@media (prefers-color-scheme: dark) {
  .dd-static-map img {
    filter: brightness(0.8) contrast(1.1);
  }
}
.dd-static-map-marker {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 50%;
  background: var(--background-color-progressive);
  border: 3px solid #fff;
  box-shadow: var(--box-shadow-medium);
}
.dd-static-map-box {
  position: absolute;
  border: 3px solid var(--border-color-progressive);
  background: rgb(51 102 204 / 15%);
  border-radius: 2px;
}
.dd-static-map-attribution {
  position: absolute;
  inset-inline-end: 0;
  bottom: 0;
  padding: 0 0.25rem;
  font-size: 0.75em;
  color: #202122;
  background: rgb(255 255 255 / 70%);
}
</style>
