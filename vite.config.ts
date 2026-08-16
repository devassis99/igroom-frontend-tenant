/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Same build-scaling choices as igroom-frontend-bo (see its vite.config.ts
 * for the long-form rationale): manual vendor chunking so react/react-dom/
 * react-router aren't re-bundled with app code on every release, Brotli +
 * gzip pre-compression at build time, the bundle visualizer gated behind
 * `pnpm analyze`, and esbuild's target matching tsconfig's ES2022.
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // vite-plugin-compression2's compression() takes one `algorithm` per
    // call (not an `algorithms` array — that option doesn't exist on
    // this plugin) — call it once per output format instead.
    compression({ algorithm: "brotliCompress" }),
    compression({ algorithm: "gzip" }),
    mode === "analyze" &&
      visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true, open: false }),
  ].filter(Boolean),
  resolve: {
    alias: {
      // import.meta.dirname (stable since Node 21.2/20.11, and this repo
      // requires >=22 — see package.json's engines) instead of
      // __dirname, which doesn't exist in an ESM module like this one.
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
}));
