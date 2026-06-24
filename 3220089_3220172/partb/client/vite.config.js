/* 3220089_3220172  2025 */

import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://cldrq5-4000.csb.app:4000",
        changeOrigin: true,
      },
    },
  },
});
