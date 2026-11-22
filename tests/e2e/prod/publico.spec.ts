import { expect, test, type Page } from "@playwright/test";

// Páginas públicas sobre el build de producción: CSP con nonce y sin
// `'unsafe-eval'`, ningún error (ni de hidratación ni de CSP) y React vivo.

function vigilar(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(`console: ${m.text()}`);
  });
  return errores;
}

function scriptSrc(csp: string): string {
  return csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
}

for (const ruta of ["/sign-in", "/docs"]) {
  test(`${ruta}: CSP con nonce, sin errores e hidratada`, async ({ page }) => {
    const errores = vigilar(page);
    const res = await page.goto(ruta);
    expect(res?.status()).toBe(200);

    const csp = (await res?.headerValue("content-security-policy")) ?? "";
    const script = scriptSrc(csp);
    expect(script).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");

    // El script de arranque del tema llevaba el nonce: si no, no habría tema.
    await expect(page.locator("html")).toHaveAttribute("data-theme", /^(light|dark)$/);
    expect(errores).toEqual([]);
  });
}

test("cada petición lleva un nonce distinto", async ({ request }) => {
  const a = (await request.get("/docs")).headers()["content-security-policy"];
  const b = (await request.get("/docs")).headers()["content-security-policy"];
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
});

test("el formulario de acceso responde (React hidratado)", async ({ page }) => {
  const errores = vigilar(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").first().fill("ana@aep.test");
  await expect(page.getByLabel("Email").first()).toHaveValue("ana@aep.test");
  // El botón solo funciona si React se ha hidratado: abre una explicación y
  // marca `aria-expanded`.
  const olvido = page.getByRole("button", { name: "¿Olvidaste tu contraseña?" });
  await expect(olvido).toHaveAttribute("aria-expanded", "false");
  await olvido.click();
  await expect(olvido).toHaveAttribute("aria-expanded", "true");
  expect(errores).toEqual([]);
});

test("la API conserva su política fija, también sin 'unsafe-eval'", async ({ request }) => {
  const res = await request.get("/api/v1/meta");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(scriptSrc(csp)).not.toContain("'unsafe-eval'");
  expect(csp).toContain("frame-ancestors 'self'");
});
