import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [["src/**/*.test.tsx", "happy-dom"]],
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
        lines: 45,
        functions: 45,
        branches: 38,
        statements: 45,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
