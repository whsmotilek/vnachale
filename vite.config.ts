import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// На GitHub Pages сайт лежит по пути /vnachale/.
// При локальном dev-режиме base = '/'.
const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [react()],
  base: isProd ? "/vnachale/" : "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
