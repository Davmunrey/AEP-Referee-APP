import { expect, test } from "@playwright/test";
import { sinDesbordamiento, vigilarErrores } from "./helpers";

// Panel de gestión en el modo de capturas (sesión de super admin, datos de
// demostración en memoria). Cada pantalla principal carga sin errores de
// JavaScript y sin desbordar, y el flujo central de la aplicación —asignar un
// juez a un hueco de la tarima— funciona de punta a punta.

const pantallas: [string, string | RegExp][] = [
  ["/", "Próximos campeonatos"],
  ["/competitions", "Campeonatos"],
  ["/referees", "Directorio de jueces"],
  ["/approvals", "Aprobaciones"],
  ["/analytics", "Estadísticas"],
  ["/regulations", "Normativa"],
  ["/tickets", "Tickets de soporte"],
];

for (const [ruta, titulo] of pantallas) {
  test(`${ruta} carga sin errores`, async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto(ruta);
    await expect(page.getByRole("heading", { name: titulo }).first()).toBeVisible();
    await sinDesbordamiento(page);
    expect(errores).toEqual([]);
  });
}

/** Si la aplicación pide confirmar (juez repetido en la sesión, aviso…), acepta. */
async function aceptarSiPregunta(page: import("@playwright/test").Page) {
  const pregunta = page.getByRole("alertdialog");
  if (await pregunta.waitFor({ timeout: 2_000 }).then(() => true, () => false)) {
    await pregunta.getByRole("button").last().click();
    await expect(pregunta).toBeHidden();
  }
}

test("asignar un juez a un hueco y liberarlo", async ({ page }) => {
  const errores = vigilarErrores(page);
  const libres = page.getByRole("button", { name: /Hueco \d+ · clic o arrastra/ });
  // `exact`: cada hueco es a su vez un botón cuyo nombre accesible INCLUYE
  // «Quitar asignación»; sin él se contaría cada hueco dos veces.
  const quitar = page.getByRole("button", { name: "Quitar asignación", exact: true });
  await page.goto("/competitions/evt-docs-001");
  await expect(page.getByRole("heading", { name: "Open Powerlifting Cantabria 2026" })).toBeVisible();
  const ocupadosAntes = await quitar.count();
  expect(await libres.count()).toBeGreaterThan(0);

  // Se elige un hueco libre y luego el juez.
  await libres.first().click();
  await expect(page.getByText(/elige un juez a la izquierda/)).toBeVisible();
  // La pantalla es optimista: pinta el cambio antes de que responda el
  // servidor. Se espera a la respuesta para no recargar con la petición en
  // vuelo (la recarga la cancelaría).
  const guardado = page.waitForResponse(
    (r) => r.url().includes("/roster/assign") && r.request().method() === "POST",
  );
  // El primer juez asignable de la lista, que viene ordenada por idoneidad
  // para ese hueco (los bloqueados por nivel o normativa van desactivados).
  await page
    .getByRole("list", { name: "Jueces disponibles" })
    .locator('li[role="button"]:not([aria-disabled="true"])')
    .first()
    .click();
  await aceptarSiPregunta(page);
  expect((await guardado).ok()).toBe(true);
  await expect(quitar).toHaveCount(ocupadosAntes + 1);

  // Tras recargar sigue asignado: no era solo estado de la pantalla.
  await page.reload();
  await expect(quitar).toHaveCount(ocupadosAntes + 1);

  // Se libera un hueco y la tarima vuelve a tener los ocupados de antes.
  const liberado = page.waitForResponse(
    (r) => r.url().includes("/roster/clear") && r.request().method() === "POST",
  );
  await quitar.last().click();
  await aceptarSiPregunta(page);
  expect((await liberado).ok()).toBe(true);
  await expect(quitar).toHaveCount(ocupadosAntes);
  await page.reload();
  await expect(quitar).toHaveCount(ocupadosAntes);

  expect(errores).toEqual([]);
});

test("la ayuda busca en la guía", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir ayuda" }).click();
  const ayuda = page.getByRole("dialog", { name: "Ayuda de AEP Tarima" });
  await expect(ayuda).toBeVisible();
  await ayuda.getByRole("searchbox", { name: "Buscar en la ayuda" }).or(ayuda.getByLabel("Buscar en la ayuda")).first().fill("contraseña");
  await expect(ayuda.getByText(/contraseña/i).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ayuda).toBeHidden();
});

test("la documentación pública carga sin sesión", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Documentación de AEP Tarima" })).toBeVisible();
  await ctx.close();
});

// Los diálogos se renderizan en <body> (Portal): cubren toda la ventana aunque
// se abran desde un contenedor con transform o backdrop-filter, que recortaba
// el overlay. Y siguen atrapando el foco y cerrándose con Escape.
const dialogos: [string, string, string][] = [
  ["/competitions/evt-docs-001", "Editar campeonato", "Editar campeonato"],
  ["/referees", "Nuevo juez", "Nuevo juez"],
];

for (const [ruta, abrir, titulo] of dialogos) {
  test(`diálogo «${titulo}»: cubre la ventana, atrapa el foco y se cierra con Escape`, async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto(ruta);
    const boton = page.getByRole("button", { name: abrir, exact: true }).first();
    await boton.click();

    const dialogo = page.getByRole("dialog", { name: titulo });
    await expect(dialogo).toBeVisible();

    // El diálogo o su overlay es hijo DIRECTO de <body>, no un nodo de la página.
    const enBody = await dialogo.evaluate(
      (el) => el.parentElement === document.body || el.parentElement?.parentElement === document.body,
    );
    expect(enBody).toBe(true);

    // El overlay ocupa toda la ventana.
    const caja = await page.evaluate(() => {
      const o = [...document.body.children].find((e) => getComputedStyle(e).position === "fixed" && e.querySelector('[role="dialog"]')) as HTMLElement | undefined
        ?? (document.querySelector('[role="dialog"]')?.closest("div.fixed") as HTMLElement | null);
      const r = (o ?? document.querySelector('[role="dialog"]')!).getBoundingClientRect();
      return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
    });
    expect(caja.w).toBeGreaterThanOrEqual(caja.vw - 1);
    expect(caja.h).toBeGreaterThanOrEqual(caja.vh - 1);

    // El foco está dentro del diálogo y Tab no se escapa de él.
    expect(await dialogo.evaluate((el) => el.contains(document.activeElement) || el.parentElement?.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]') || !!document.activeElement?.closest(".fixed"))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(boton).toBeFocused();
    expect(errores).toEqual([]);
  });
}
