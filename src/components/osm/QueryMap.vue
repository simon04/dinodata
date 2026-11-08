<template>
  <div ref="container" class="dd-query-map" :aria-label="t('osm-query-map')" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import {
  Circle,
  CircleMarker,
  LayerGroup,
  MaplairMap,
  Polyline,
  Rectangle,
  TileLayer,
} from "maplair";
import "maplair/styles.css";
import { t } from "../../i18n";
import type { Bounds } from "../../osm/geocoding";
import type { LatLon, MapView } from "../../osm/osm-ref";
import { queryRadius } from "../../osm/overpass";

/**
 * Interactive map for “Query features”: a click (or tap) queries the objects
 * at that point, the search radius follows the zoom like on osm.org.
 */
const props = defineProps<{
  /** queried location */
  query?: MapView;
  /** geometry of the hovered result */
  highlight?: LatLon[][] | Bounds;
}>();
const emit = defineEmits<{ query: [view: MapView] }>();

/** last map view, for the next visit */
const lastView = useLocalStorage<MapView>("dinodata.osm.map", {
  lat: 47.2692,
  lon: 11.4041,
  zoom: 13,
});

const container = useTemplateRef("container");
let map: MaplairMap | undefined;
let queryLayer: LayerGroup | undefined;
let highlightLayer: LayerGroup | undefined;

const style = getComputedStyle(document.documentElement);
const color = () =>
  style.getPropertyValue("--color-progressive").trim() || "#36c";

function drawQuery() {
  if (!map || !queryLayer) return;
  queryLayer.clearLayers();
  const q = props.query;
  if (!q) return;
  new Circle([q.lat, q.lon], {
    radius: queryRadius(q.zoom),
    color: color(),
    weight: 2,
    fillOpacity: 0.1,
    interactive: false,
  }).addTo(queryLayer);
}

function drawHighlight() {
  if (!map || !highlightLayer) return;
  highlightLayer.clearLayers();
  const h = props.highlight;
  if (!h) return;
  const options = { color: "#f60", weight: 4, interactive: false };
  if (!Array.isArray(h)) {
    new Rectangle(
      [
        [h.minlat, h.minlon],
        [h.maxlat, h.maxlon],
      ],
      { ...options, fillOpacity: 0.05 },
    ).addTo(highlightLayer);
    return;
  }
  for (const line of h)
    if (line.length === 1)
      new CircleMarker([line[0].lat, line[0].lon], {
        ...options,
        radius: 8,
        fillOpacity: 0.5,
      }).addTo(highlightLayer);
    else
      new Polyline(
        line.map((p) => [p.lat, p.lon]),
        options,
      ).addTo(highlightLayer);
}

onMounted(() => {
  const start = props.query ?? lastView.value;
  map = new MaplairMap(container.value!).setView(
    [start.lat, start.lon],
    start.zoom,
  );
  new TileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  queryLayer = new LayerGroup().addTo(map);
  highlightLayer = new LayerGroup().addTo(map);
  map.on("moveend", () => {
    const c = map!.getCenter();
    lastView.value = { lat: c.lat, lon: c.lng, zoom: map!.getZoom() };
  });
  map.on("click", (e) => {
    const { lat, lng } = map!.wrapLatLng(e.latlng);
    emit("query", { lat, lon: lng, zoom: map!.getZoom() });
  });
  drawQuery();
});

onBeforeUnmount(() => {
  map?.remove();
  map = undefined;
});

watch(
  () => props.query,
  (q) => {
    drawQuery();
    // follow queries from the URL or search, keep the view for map clicks
    if (map && q && !map.getBounds().contains([q.lat, q.lon]))
      map.setView([q.lat, q.lon], q.zoom);
  },
);
watch(() => props.highlight, drawHighlight);
</script>

<style scoped>
.dd-query-map {
  height: 18rem;
  border-radius: var(--border-radius-base);
  box-shadow: var(--box-shadow-medium);
  cursor: crosshair;
  /* Maplair's z-indexes stay below the header and dialogs */
  isolation: isolate;
}
.dd-query-map :deep(.maplair-grab) {
  cursor: crosshair;
}
.dd-query-map :deep(.maplair-dragging .maplair-grab) {
  cursor: grabbing;
}
@media (prefers-color-scheme: dark) {
  .dd-query-map :deep(.maplair-tile-pane) {
    filter: brightness(0.8) contrast(1.1);
  }
}
</style>
