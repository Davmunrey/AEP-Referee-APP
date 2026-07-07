import { resolveZoneCode } from "@/lib/aep-zones";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { canManageSanctions } from "@/lib/permissions";
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
  const duration = String(
    (body as { duration?: string }).duration ?? "30d",
  ) as SanctionDurationPreset;
  const fechaFinCustom = (body as { fechaFin?: string }).fechaFin;
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
    return jsonServerError("sanctions.POST", e, "No se pudo crear la sanción");
  }
}
