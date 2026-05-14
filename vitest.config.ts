import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/test/mocks/vscode.ts")
    }
  },
  test: {
    environment: "node",
    include: ["src/test/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "dist/**"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 95
      }
    }
  }
});
