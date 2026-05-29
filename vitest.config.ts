import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/dashboard-intelligence.ts",
        "src/lib/judge-stats.ts",
        "src/lib/roster-rules.ts",
        "src/lib/auth/session.ts",
        "src/lib/aep-zones.ts",
        "src/lib/roster-template.ts",
        "src/lib/referee-competition-history.ts",
        "src/server/services/referee-sanctions.ts",
        "src/app/api/v1/**/*.ts",
      ],
    },
  },
});
