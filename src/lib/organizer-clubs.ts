/** Clubes organizadores frecuentes en campeonatos AEP (editable + autocompletado). */
export const KNOWN_ORGANIZER_CLUBS = [
  "Young Ambition Cantabria",
  "Club Myrtea Lifting",
  "Halterofilia Aragón",
  "Club Halterofilia Castellón",
  "Powerlifting Madrid",
  "Club Deportivo Levante",
  "Asociación Galega de Halterofilia",
  "Club Halterofilia Sevilla",
  "Haltero Club Málaga",
  "Iron Warriors Barcelona",
] as const;

export function normalizeClubEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function formatClubEmails(emails: string[]): string {
  return emails.join(", ");
}
