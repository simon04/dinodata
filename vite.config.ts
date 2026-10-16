import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

// https://viteplus.dev/config/
export default defineConfig({
  // relative paths: served from GitHub Pages (/dinodata/) and Toolforge (/)
  base: "./",
  plugins: [vue()],
  fmt: {
    htmlWhitespaceSensitivity: "ignore",
    printWidth: 80,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: false,
    },
  },
  test: {
    // browser APIs (sessionStorage, navigator, DOM) for the modules under test
    environment: "happy-dom",
  },
  staged: {
    "*": "vp check --fix",
  },
});
