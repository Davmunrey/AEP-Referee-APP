import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // ESLint flat config ya ignora node_modules y .git, pero NO los artefactos
    // de build de Next, los tipos generados ni los informes de test. Sin esto,
    // `eslint .` lintaría miles de ficheros generados (lo que `next lint` evitaba).
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
];

export default eslintConfig;
