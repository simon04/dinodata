import { createApp } from "vue";
import App from "./App.vue";
import { lazyTooltip } from "./tooltip";

createApp(App)
  // Codex tooltips for icon-only buttons, also shown on keyboard focus
  .directive("tooltip", lazyTooltip)
  .mount("#app");
