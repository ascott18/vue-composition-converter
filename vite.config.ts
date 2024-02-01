import { fileURLToPath, URL } from "url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  base: '/vue-composition-converter/',
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // lib: {
    //   entry: fileURLToPath(new URL("./src/lib/converter.ts", import.meta.url)),
    //   formats: ["es"],
    //   fileName: () => "converter.mjs",
    // },
    // rollupOptions: {
    //   external: ["vue", "vue/compiler-sfc", "typescript"],
    // },
  },
});
