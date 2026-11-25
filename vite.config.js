import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
const standalone = process.env.STANDALONE === "1";
export default defineConfig({
  // base relativa: o mesmo build funciona em dominio proprio ou em subpasta
  base: "./",
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  build: { outDir: standalone ? "dist-standalone" : "dist", assetsInlineLimit: standalone ? 1e8 : 4096, chunkSizeWarningLimit: 5000 },
});
