import { expect, test } from "@playwright/test";
import { comoJuez, sinDesbordamiento, vigilarErrores } from "./helpers";

// Portal del juez en el modo de capturas (sesión de Ana Roa, ficha j001).

test.beforeEach(async ({ page }) => {
  await comoJuez(page);
});

test("el portal muestra sus designaciones y convocatorias", async ({ page }) => {
  const errores = vigilarErrores(page);
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próximas designaciones" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Convocatorias abiertas" })).toBeVisible();
  await sinDesbordamiento(page);
  expect(errores).toEqual([]);
});

test("las secciones del portal cargan", async ({ page }) => {
  const errores = vigilarErrores(page);
  for (const ruta of ["/portal/ficha", "/portal/convocatorias", "/portal/sesiones"]) {
    const res = await page.goto(ruta);
    expect(res?.status(), ruta).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test("un juez que abre el panel de gestión vuelve a su portal", async ({ page }) => {
  await page.goto("/competitions");
  await expect(page).toHaveURL(/\/portal/);
});
