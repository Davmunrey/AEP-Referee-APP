import { macroZoneName, resolveZoneCode, type AepMacroZoneId } from "@/lib/aep-zones";
import type { RefereeSanction, SanctionDurationPreset, ZoneDelegate } from "@/lib/types";

export const SANCTION_DURATION_PRESETS: {
  id: SanctionDurationPreset;
  label: string;
  days: number;
}[] = [
  { id: "7d", label: "7 días", days: 7 },
  { id: "14d", label: "14 días", days: 14 },
  { id: "30d", label: "30 días", days: 30 },
  { id: "90d", label: "90 días", days: 90 },
  { id: "180d", label: "6 meses", days: 180 },
  { id: "365d", label: "1 año", days: 365 },
  { id: "custom", label: "Fecha fin manual", days: 0 },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Zona horaria de negocio: las fechas de sanción son días naturales en España. */
const BUSINESS_TZ = "Europe/Madrid";

export function todayIso(): string {
  // "Hoy" en hora española, no en UTC: con toISOString() una sanción que
  // termina hoy seguía activa (y el barrido no la expiraba) entre la
  // medianoche local y la 01:00–02:00.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

export function addDaysIso(startIso: string, days: number): string {
  const d = new Date(`${startIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolveSanctionEndDate(
  fechaInicio: string,
  preset: SanctionDurationPreset,
  fechaFinCustom?: string,
): string {
  if (preset === "custom") {
    if (!fechaFinCustom || !ISO_DATE.test(fechaFinCustom)) {
      throw new Error("Indica una fecha de fin válida");
    }
    if (fechaFinCustom < fechaInicio) {
      throw new Error("La fecha de fin no puede ser anterior al inicio");
    }
    return fechaFinCustom;
  }
  const entry = SANCTION_DURATION_PRESETS.find((p) => p.id === preset);
  if (!entry || entry.days <= 0) {
    throw new Error("Duración de sanción no válida");
  }
  return addDaysIso(fechaInicio, entry.days);
}

export function daysUntil(isoDate: string): number {
  // Diferencia en días naturales respecto a "hoy" en la zona de negocio,
  // contando el propio día de fin (hoy → 1), como hacía la versión anterior
  // pero sin mezclar UTC con hora local del servidor.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const end = Date.parse(`${isoDate}T00:00:00Z`);
  const today = Date.parse(`${todayIso()}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(today)) return 0;
  return Math.round((end - today) / MS_PER_DAY) + 1;
}

export function isSanctionActive(s: Pick<RefereeSanction, "status" | "fechaFin">): boolean {
  if (s.status !== "activa") return false;
  return s.fechaFin >= todayIso();
}

export function formatSanctionPeriod(fechaInicio: string, fechaFin: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(fechaInicio)} → ${fmt(fechaFin)}`;
}

export function buildSanctionMailto(
  delegates: ZoneDelegate[],
  sanction: Pick<
    RefereeSanction,
    "refereeName" | "motivo" | "fechaInicio" | "fechaFin" | "zona" | "impuestaPorNombre"
  >,
): string {
  const emails = delegates.map((d) => d.email).filter(Boolean);
  if (emails.length === 0) return "";
  const zonaLabel = macroZoneName(resolveZoneCode(sanction.zona) ?? sanction.zona);
  const subject = encodeURIComponent(
    `[AEP Tarima] Sanción: ${sanction.refereeName}`,
  );
  const body = encodeURIComponent(
    [
      "Aviso de sanción disciplinaria a juez/a",
      "",
      `Juez: ${sanction.refereeName}`,
      `Zona: ${zonaLabel}`,
      `Periodo: ${formatSanctionPeriod(sanction.fechaInicio, sanction.fechaFin)}`,
      `Motivo: ${sanction.motivo}`,
      `Impuesta por: ${sanction.impuestaPorNombre}`,
      "",
      "El juez queda no disponible para designaciones en tarima hasta la fecha de fin.",
      "",
      "— AEP Tarima",
    ].join("\n"),
  );
  return `mailto:${emails.join(",")}?subject=${subject}&body=${body}`;
}

export function sanctionStatusLabel(status: RefereeSanction["status"]): string {
  switch (status) {
    case "activa":
      return "Activa";
    case "cumplida":
      return "Cumplida";
    case "revocada":
      return "Revocada";
  }
}

export function zoneLabel(code: string): string {
  return macroZoneName(resolveZoneCode(code) as AepMacroZoneId | undefined ?? code);
}
