import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/server/**/*.ts"],
      exclude: ["src/lib/client.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
    },
  },
});
