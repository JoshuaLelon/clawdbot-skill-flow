import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 30,
        functions: 50,
        branches: 75,
        statements: 30,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/examples/**",
        "node_modules/",
        "dist/",
        "tests/",
        "**/*.config.ts",
        "types.d.ts",
      ],
    },
  },
});
