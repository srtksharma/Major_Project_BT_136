import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Unit tests for the pure lib layer (URL parsing, defanging, CSV
 *  safety, batch parsing, Zod validators). Node environment only —
 *  no DOM, so they stay fast and robust. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
