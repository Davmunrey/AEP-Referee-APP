/**
 * Enlaces de origen humano que acaban en un `href`.
 *
 * El «enlace adjunto» de un informe es texto libre: guardado como
 * `javascript:…`, el navegador ejecuta ese código en el origen de la
 * aplicación en cuanto alguien pulsa el enlace —XSS almacenado de un usuario
 * con permiso de gestión contra cualquiera que abra el informe, incluido un
 * super admin—. Solo se aceptan esquemas de navegación reales.
 */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** La URL si es navegable y segura; `null` en cualquier otro caso. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    // Sin base: exige una URL absoluta. Un `//evil.com` o un `/ruta` relativos
    // no son enlaces adjuntos válidos y aquí se descartan.
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

/** `true` si el valor es un enlace externo aceptable (o está vacío). */
export function isSafeExternalUrlOrEmpty(value: string | null | undefined): boolean {
  if (value === undefined || value === null || value.trim() === "") return true;
  return safeExternalUrl(value) !== null;
}
