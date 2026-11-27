import { useLocalStorage } from "@vueuse/core";

/**
 * Whether history tables wrap long lines instead of scrolling sideways;
 * shared by the Wikidata and OSM history and the contributions of a user.
 */
export const historyWrap = useLocalStorage("dinodata.history-wrap", false);
