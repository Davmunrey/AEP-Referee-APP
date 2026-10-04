import { after } from "next/server";

/**
 * Trabajo que no tiene por qué hacer esperar a quien pidió la página o la
 * acción (avisos, revisiones periódicas): `after()` lo ejecuta al terminar la
 * respuesta. Fuera de una petición —pruebas, scripts— `after` lanza; ahí se
 * ejecuta sin esperar y sin romper a quien llama.
 */
export function afterResponse(task: () => unknown): void {
  try {
    after(async () => {
      await task();
    });
  } catch {
    void Promise.resolve()
      .then(task)
      .catch((err) => console.error("[afterResponse]", err));
  }
}
