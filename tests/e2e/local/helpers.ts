import { expect, type Page } from "@playwright/test";

/** El mismo puerto que `playwright.local.config.ts`. */
export const BASE = `http://localhost:${process.env.E2E_PORT ?? 3101}`;

/**
 * Carrera propia del servidor de DESARROLLO: envía las páginas largas
 * troceadas y despacio, y a veces React empieza a hidratar antes de que el
 * navegador termine de leer el HTML (en /docs, ~1 de cada 2 cargas). Con el
 * build de producción no ocurre nunca (0 de 20 cargas), y eso lo comprueba
 * `tests/e2e/prod`, que sí falla ante cualquier error de hidratación.
 */
const CARRERA_DE_DESARROLLO = /^Hydration failed because the server rendered HTML didn't match the client/;

/** Recoge errores de JavaScript de la página para comprobar al final que no hubo. */
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => {
    if (!CARRERA_DE_DESARROLLO.test(e.message)) errores.push(`pageerror: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !CARRERA_DE_DESARROLLO.test(m.text())) errores.push(`console: ${m.text()}`);
  });
  return errores;
}

export async function sinDesbordamiento(page: Page) {
  const exceso = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(exceso, "la página no debe desbordar en horizontal").toBeLessThanOrEqual(2);
}

/** Entra como juez en el modo de capturas (cookie que solo lee ese modo). */
export async function comoJuez(page: Page) {
  await page.context().addCookies([{ name: "aep-captura-rol", value: "juez", url: BASE }]);
}
