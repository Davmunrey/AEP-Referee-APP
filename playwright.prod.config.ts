import { defineConfig, devices } from "@playwright/test";

/**
 * Humo contra el BUILD DE PRODUCCIÓN, sin secretos: `next start` sobre lo que
 * dejó `next build`, sin Supabase. Solo cubre lo que no necesita sesión (acceso
 * y documentación) y comprueba justo lo que el modo desarrollo no puede:
 * la CSP con nonce real (sin `'unsafe-eval'`) y que la hidratación no falla.
 *
 * Requiere `npm run build` antes (en CI lo hace el mismo job).
 */
const port = Number(process.env.E2E_PROD_PORT ?? 3102);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e/prod",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-prod" }]],
  outputDir: "test-results-prod",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/docs`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
