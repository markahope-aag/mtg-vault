import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/proxy.ts", "src/app/api/**", "src/components/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/lib/ai/**",
        "src/lib/supabase/**",
        "src/components/ui/**",
      ],
      thresholds: {
        // Lib + proxy are the regression gate; API/UI coverage is tracked but not blocking yet.
        "src/lib/**": {
          lines: 45,
          functions: 45,
          branches: 38,
          statements: 45,
        },
        "src/proxy.ts": {
          lines: 45,
          functions: 20,
          branches: 50,
          statements: 45,
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
