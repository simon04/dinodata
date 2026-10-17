/**
 * OpenStreetMap website and API 0.6 (CORS enabled). Both can be switched to
 * the dev server (`https://master.apis.dev.openstreetmap.org`) via
 * `VITE_OSM_URL`, e.g. for testing uploads.
 */
export const OSM_URL = (
  import.meta.env.VITE_OSM_URL || "https://www.openstreetmap.org"
).replace(/\/$/, "");

export const OSM_API =
  OSM_URL === "https://www.openstreetmap.org"
    ? "https://api.openstreetmap.org/api/0.6"
    : `${OSM_URL}/api/0.6`;
