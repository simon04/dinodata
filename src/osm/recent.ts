import { createGlobalState, useLocalStorage } from "@vueuse/core";
import type { OsmRef } from "./osm-ref";

export interface RecentElement extends OsmRef {
  name: string;
  icon?: string;
  preset?: string;
}

const MAX = 20;

/** Recently opened OSM objects, newest first, for the OSM home page. */
export const useRecent = createGlobalState(() => {
  const recent = useLocalStorage<RecentElement[]>("dinodata.osm.recent", []);
  function add(element: RecentElement) {
    recent.value = [
      element,
      ...recent.value.filter(
        (r) => r.type !== element.type || r.id !== element.id,
      ),
    ].slice(0, MAX);
  }
  function clear() {
    recent.value = [];
  }
  return { recent, add, clear };
});
