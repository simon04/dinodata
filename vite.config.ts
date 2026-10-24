import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import { execFileSync } from "node:child_process";

/** last commit as `<hash> <YYYY-MM-DD>`, empty without a git checkout */
function gitVersion(): string {
  try {
    return execFileSync("git", ["log", "-1", "--format=%h %cs"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}
const [commitHash = "", commitDate = ""] = gitVersion().split(" ");
// exposed as import.meta.env.VITE_*, unless already set in the environment
process.env.VITE_COMMIT_HASH ??= commitHash;
process.env.VITE_COMMIT_DATE ??= commitDate;

// https://viteplus.dev/config/
export default defineConfig({
  // relative paths: served from GitHub Pages (/dinodata/) and Toolforge (/)
  base: "./",
  plugins: [vue()],
  // the OAuth callback of the dev consumer is http://localhost:5173/oauth-callback
  server: { port: 5173, strictPort: true },
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
