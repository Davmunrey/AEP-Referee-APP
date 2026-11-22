import { expect, test } from "@playwright/test";
import { comoJuez, sinDesbordamiento, vigilarErrores } from "./helpers";

// Tamaño de móvil (iPhone 13): las pantallas que más se usan desde el teléfono
// no desbordan en horizontal y cargan sin errores.

for (const ruta of ["/", "/competitions", "/competitions/evt-docs-001", "/referees", "/docs"]) {
  test(`gestión en móvil: ${ruta}`, async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto(ruta);
    await expect(page.locator("main").first()).toBeVisible();
    await sinDesbordamiento(page);
    expect(errores).toEqual([]);
  });
}

test("portal del juez en móvil", async ({ page }) => {
  await comoJuez(page);
  const errores = vigilarErrores(page);
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();
  await sinDesbordamiento(page);
  expect(errores).toEqual([]);
});
