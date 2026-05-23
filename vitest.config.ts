import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/ai/**",
        "src/lib/supabase/**",
      ],
      thresholds: {
        // Floor for all of src/lib — raises as more modules get tests.
        lines: 38,
        functions: 38,
        branches: 33,
        statements: 38,
        // High bars on modules under active test.
        "src/lib/importers/**": {
          lines: 84,
          functions: 85,
          branches: 75,
          statements: 84,
        },
        "src/lib/bracket-engine-logic.ts": {
          lines: 85,
          functions: 90,
          branches: 60,
          statements: 85,
        },
        "src/lib/bracket-engine.ts": {
          lines: 90,
          functions: 100,
          statements: 90,
        },
        "src/lib/decks/slots.ts": {
          lines: 85,
          functions: 100,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
