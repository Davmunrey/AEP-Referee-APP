/**
 * Capturas REALES de la plataforma AEP Tarima para el manual PDF.
 *
 * Modo local (sin Supabase): arranca el servidor con AEP_DOCS_CAPTURE=1 y datos de demo.
 * Modo producción: DOCS_SCREENSHOT_BASE + E2E_EMAIL + E2E_PASSWORD.
 *
 * Uso: npm run docs:screenshots
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
const DOCS_CAPTURE_COMPETITION_ID = "evt-docs-001";

const OUT = join(process.cwd(), "docs/images");
const PORT = Number(process.env.DOCS_SCREENSHOT_PORT ?? 3199);
const BASE = process.env.DOCS_SCREENSHOT_BASE ?? `http://localhost:${PORT}`;
const USE_LOCAL_CAPTURE = !process.env.DOCS_SCREENSHOT_BASE;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const VIEWPORT = { width: 1440, height: 900 };

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status === 307 || res.status === 302) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Servidor no disponible en ${url}`);
}

function startLocalServer() {
  const child = spawn(
    "npx",
    ["next", "dev", "--turbopack", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AEP_DOCS_CAPTURE: "1",
        NEXT_PUBLIC_RUN_LOCAL: "true",
        // Sin Supabase → memoria + sesión de captura
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (d) => process.stdout.write(`[dev] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[dev] ${d}`));
  return child;
}

async function loginIfNeeded(page) {
  if (USE_LOCAL_CAPTURE) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    if (page.url().includes("/sign-in")) {
      throw new Error("Modo captura local debería entrar sin login");
    }
    return;
  }

  if (!EMAIL || !PASSWORD) {
    throw new Error("Para capturas en producción define E2E_EMAIL y E2E_PASSWORD");
  }

  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").fill(EMAIL);
  await page.getByPlaceholder("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/($|\?)/, { timeout: 30_000 });
}

async function resolveCompetitionId(page) {
  if (USE_LOCAL_CAPTURE) return DOCS_CAPTURE_COMPETITION_ID;
  await page.goto(`${BASE}/competitions`, { waitUntil: "networkidle" });
  const link = page.locator('a[href^="/competitions/"]').filter({ hasNotText: "Nuevo" }).first();
  const href = await link.getAttribute("href");
  const id = href?.split("/").filter(Boolean).pop();
  if (!id || id === "new") throw new Error("No se encontró campeonato para capturas");
  return id;
}

async function shot(page, file, fn) {
  await fn();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, file), fullPage: false });
  console.log("✓", file);
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  let server;
  if (USE_LOCAL_CAPTURE) {
    console.log(`Arrancando servidor local en :${PORT} (AEP_DOCS_CAPTURE=1)…`);
    server = startLocalServer();
    await waitForServer(`${BASE}/sign-in`);
  } else {
    console.log(`Capturas contra ${BASE}`);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });

  try {
    await loginIfNeeded(page);
    const compId = await resolveCompetitionId(page);

    await shot(page, "00-sign-in.png", async () => {
      await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
    });

    await shot(page, "01-dashboard.png", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.getByText("Radar operativo").first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "02-campeonatos.png", async () => {
      await page.goto(`${BASE}/competitions`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Campeonatos/i }).first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "04-tarima-montada.png", async () => {
      await page.goto(`${BASE}/competitions/${compId}`, { waitUntil: "networkidle" });
      await page.locator("main").first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "09-cuadrante-export.png", async () => {
      await page.goto(`${BASE}/competitions/${compId}`, { waitUntil: "networkidle" });
      const exportBtn = page.getByRole("button", { name: "Exportar" });
      if (await exportBtn.isVisible().catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(300);
      }
    });

    await shot(page, "11-compensacion-hub.png", async () => {
      await page.goto(`${BASE}/compensation`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Compensación/i }).first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "10-compensacion.png", async () => {
      await page.goto(`${BASE}/competitions/${compId}/compensation`, { waitUntil: "networkidle" });
      await page.getByText(/Compensación/i).first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "05-directorio.png", async () => {
      await page.goto(`${BASE}/referees`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Directorio/i }).first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "07-estadisticas.png", async () => {
      await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle" });
      await page.locator("main").first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "08-usuarios.png", async () => {
      await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
      await page.locator("main").first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "12-sidebar.png", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.getByText("Documentación").first().waitFor({ timeout: 15_000 });
    });

    await shot(page, "00-docs.png", async () => {
      await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
      await page.getByText("Documentación").first().waitFor({ timeout: 15_000 });
    });

    console.log(`\nCapturas guardadas en ${OUT}`);
  } finally {
    await page.close();
    await browser.close();
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
