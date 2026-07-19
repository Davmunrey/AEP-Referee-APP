import { resolveZoneCode } from "@/lib/aep-zones";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { canManageSanctions } from "@/lib/permissions";
import { SANCTION_DURATION_PRESETS } from "@/lib/sanctions";
import { ISO_DATE_RE } from "@/app/api/_lib/validation";
import type { SanctionDurationPreset } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const referee = await dataService.getReferee(id);
  if (!referee) return jsonError("Juez no encontrado", 404);
  if (user.role === "delegado_zona" && user.zona) {
    const uz = resolveZoneCode(user.zona);
    const rz = resolveZoneCode(referee.zona);
    if (uz !== rz) return jsonError("Sin permiso", 403);
  }
  const sanctions = await dataService.listRefereeSanctions(id);
  return jsonOk(sanctions);
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const referee = await dataService.getReferee(id);
  if (!referee) return jsonError("Juez no encontrado", 404);
  if (!canManageSanctions(user, referee.zona)) {
    return jsonError("Sin permiso para sancionar en esta zona", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo inválido", 400);
  }
  const motivo = String((body as { motivo?: string }).motivo ?? "").trim();
  if (motivo.length < 10) {
    return jsonError("Describe el motivo (mínimo 10 caracteres)", 400);
  }
  const fechaInicio = String(
    (body as { fechaInicio?: string }).fechaInicio ?? "",
  ).slice(0, 10);
  // Valida formato y presets ANTES de castear: entradas malformadas son un
  // 400 con mensaje claro, no un 500 genérico.
  if (fechaInicio && !ISO_DATE_RE.test(fechaInicio)) {
    return jsonError("La fecha de inicio debe tener formato AAAA-MM-DD", 400);
  }
  const durationRaw = String((body as { duration?: string }).duration ?? "30d");
  if (!SANCTION_DURATION_PRESETS.some((p) => p.id === durationRaw)) {
    return jsonError("Duración de sanción no válida", 400);
  }
  const duration = durationRaw as SanctionDurationPreset;
  const fechaFinCustom = (body as { fechaFin?: string }).fechaFin;
  if (
    duration === "custom" &&
    (typeof fechaFinCustom !== "string" || !ISO_DATE_RE.test(fechaFinCustom))
  ) {
    return jsonError("Indica una fecha de fin válida", 400);
  }
  const notas = (body as { notas?: string }).notas;

  try {
    const sanction = await dataService.createRefereeSanction({
      refereeId: referee.id,
      refereeName: referee.nombre,
      zona: referee.zona,
      motivo,
      fechaInicio: fechaInicio || new Date().toISOString().slice(0, 10),
      duration,
      fechaFinCustom,
      notas,
      impuestaPor: user,
    });
    return jsonOk(sanction);
  } catch (e) {
    // Errores de validación de resolveSanctionEndDate → 400 con su mensaje.
    const msg = e instanceof Error ? e.message : "";
    if (
      msg.startsWith("Indica una fecha") ||
      msg.startsWith("La fecha de fin") ||
      msg.startsWith("Duración de sanción")
    ) {
      return jsonError(msg, 400);
    }
    return jsonServerError("sanctions.POST", e, "No se pudo crear la sanción");
  }
}
