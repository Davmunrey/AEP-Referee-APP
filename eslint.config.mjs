import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  // ESLint ya ignora node_modules y .git, pero NO los artefactos de build de
  // Next, los tipos generados ni los informes de test.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "playwright-report-*/**",
    "test-results/**",
    "test-results-*/**",
    "next-env.d.ts",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Convención: prefijo `_` marca parámetros/variables intencionadamente sin usar
      // (p. ej. stubs de modo memoria que ignoran sus argumentos).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);
