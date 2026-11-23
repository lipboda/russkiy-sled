import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [react(), tailwindcss()],
  cacheDir: ".offline-cache",
  build: {
    outDir: process.env.EXPORT_DIR,
    emptyOutDir: true,
    modulePreload: false,
    lib: {
      entry: "src/main.tsx",
      name: "RusskiySledOffline",
      formats: ["iife"],
      fileName: () => "assets/site.js",
      cssFileName: "assets/site",
    },
    cssCodeSplit: false,
    copyPublicDir: true,
    target: ["es2020", "safari15.4"],
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
