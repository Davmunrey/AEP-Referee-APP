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

export function normalizeClubEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
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

/** E-mails sugeridos al elegir un club (coincidencia exacta o parcial). */
export function suggestedEmailsForClubName(name: string): string[] {
  const exact = AEP_CLUBS_REGISTRY.clubs.filter(
    (c) => normalizeClubName(c.name) === normalizeClubName(name),
  );
  const partial = exact.length > 0 ? exact : findClubsByName(name);
  return [...new Set(partial.map((c) => c.email.toLowerCase()))];
}

export function clubRegistryMeta() {
  return {
    source: AEP_CLUBS_REGISTRY.source,
    updatedAt: AEP_CLUBS_REGISTRY.updatedAt,
    count: AEP_CLUBS_REGISTRY.count,
  };
}
