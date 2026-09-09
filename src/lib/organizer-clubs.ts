import { AEP_CLUBS_CURATED } from "./aep-clubs-curated";

export interface AepClubRecord {
  region: string;
  province: string;
  locality: string;
  name: string;
  responsible: string;
  email: string;
}

export const AEP_CLUBS_REGISTRY = {
  source: "Listado curado AEP (junio 2026)",
  updatedAt: "2026-06-28",
  count: AEP_CLUBS_CURATED.length,
  clubs: AEP_CLUBS_CURATED.map(
    (club): AepClubRecord => ({
      region: "",
      province: "",
      locality: "",
      name: club.name.trim(),
      responsible: "",
      email: club.email.trim().toLowerCase(),
    }),
  ),
};

/** Normaliza nombre de club para búsqueda/autocompletado. */
export function normalizeClubName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Listado único de nombres de club para datalist (orden alfabético). */
export const KNOWN_ORGANIZER_CLUBS: string[] = [
  ...new Set(AEP_CLUBS_REGISTRY.clubs.map((c) => c.name.trim())),
].sort((a, b) => a.localeCompare(b, "es"));

/**
 * Una dirección con forma de dirección: algo, arroba, dominio con punto.
 *
 * El filtro era `includes("@")`, que deja pasar «a@», «@b» y «juan@club» —sin
 * dominio de primer nivel—. Eso se guardaba como e-mail de devolución del
 * recibo y el envío no llegaba a ninguna parte, sin que nada lo dijera. No
 * pretende validar el estándar entero: solo descartar lo que seguro no es una
 * dirección.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function isClubEmailShaped(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim().toLowerCase());
}

export function normalizeClubEmails(raw: string): string[] {
  const vistos = new Set<string>();
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => {
      if (!isClubEmailShaped(e) || vistos.has(e)) return false;
      vistos.add(e);
      return true;
    });
}

export function formatClubEmails(emails: string[]): string {
  return emails.join(", ");
}

/** Busca clubes por nombre (contiene, sin acentos). */
export function findClubsByName(query: string): AepClubRecord[] {
  const q = normalizeClubName(query);
  if (!q) return [];
  return AEP_CLUBS_REGISTRY.clubs.filter((c) => normalizeClubName(c.name).includes(q));
}

/**
 * E-mails sugeridos al elegir un club. Solo cuando no hay duda de cuál es.
 *
 * Antes caía en la coincidencia PARCIAL: si el nombre escrito no era exacto,
 * devolvía los e-mails de todos los clubes que lo contuvieran. Y quien la llama
 * lo hace en cada pulsación de tecla, con el campo de e-mails aún vacío, así
 * que al teclear la primera letra del nombre del club se rellenaba con las
 * direcciones de casi todo el registro —«A» casa con 173 de los 180 clubes—.
 * A partir de ahí el campo ya no estaba vacío, así que la sugerencia no volvía
 * a corregirse: esas direcciones se quedaban puestas.
 *
 * Y no es un campo cualquiera: es el de devolución del recibo de compensación,
 * el documento con el dinero de un juez.
 *
 * Ahora se sugiere con la coincidencia exacta —que es lo que produce elegir del
 * desplegable— o cuando el texto escrito casa con UN solo club. En cualquier
 * otro caso no se sugiere nada, que es la respuesta honesta.
 */
export function suggestedEmailsForClubName(name: string): string[] {
  const exact = AEP_CLUBS_REGISTRY.clubs.filter(
    (c) => normalizeClubName(c.name) === normalizeClubName(name),
  );
  if (exact.length > 0) {
    return [...new Set(exact.map((c) => c.email.toLowerCase()))];
  }
  const partial = findClubsByName(name);
  const unicos = [...new Set(partial.map((c) => normalizeClubName(c.name)))];
  if (unicos.length !== 1) return [];
  return [...new Set(partial.map((c) => c.email.toLowerCase()))];
}

export function clubRegistryMeta() {
  return {
    source: AEP_CLUBS_REGISTRY.source,
    updatedAt: AEP_CLUBS_REGISTRY.updatedAt,
    count: AEP_CLUBS_REGISTRY.count,
  };
}
