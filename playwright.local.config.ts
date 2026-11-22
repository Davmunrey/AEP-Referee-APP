import { defineConfig, devices } from "@playwright/test";

/**
 * E2E sin secretos: la aplicación arranca en el modo de capturas
 * (AEP_DOCS_CAPTURE=1), con datos de demostración en memoria y sin Supabase.
 * Corre en cada pull request, antes de fusionar, sin tocar producción.
 *
 * Las pruebas contra Supabase real siguen en `playwright.config.ts` y solo se
 * ejecutan tras fusionar, porque necesitan la clave de servicio.
 *
 * `PLAYWRIGHT_EXECUTABLE_PATH` permite usar un Chromium ya instalado.
 */
const port = Number(process.env.E2E_PORT ?? 3101);
const baseURL = `http://localhost:${port}`;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e/local",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Un solo servidor en memoria: las pruebas que escriben (asignar un juez) no
  // deben pisarse con las que leen.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-local" }]],
  outputDir: "test-results-local",
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: "escritorio",
      testIgnore: /movil\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "movil",
      testMatch: /movil\.spec\.ts/,
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npx next dev --turbopack -p ${port}`,
    url: `${baseURL}/docs`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AEP_DOCS_CAPTURE: "1",
      NEXT_PUBLIC_RUN_LOCAL: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
