import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

// https://viteplus.dev/config/
export default defineConfig({
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
  staged: {
    "*": "vp check --fix",
  },
});
