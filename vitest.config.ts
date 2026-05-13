import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["dist/**", "src/test/**"]
    }
  }
});
