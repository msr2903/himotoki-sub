import { resolve } from "path";
import { defineConfig } from "vitest/config";

/** Unit tests for pure logic (no DOM, no extension APIs). Browser flows live in scripts/e2e. */
export default defineConfig({
  resolve: {
    alias: {
      "@src": resolve(__dirname, "src"),
      "@assets": resolve(__dirname, "src/assets"),
      "@pages": resolve(__dirname, "src/pages"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
