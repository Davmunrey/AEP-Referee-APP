import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { RefereeLevel } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  return jsonOk(await dataService.getPromotions(user));
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const refereeId = String(body.refereeId ?? "").trim();
  const toLevel = String(body.toLevel ?? "").trim() as RefereeLevel;
  const motivo = body.motivo ? String(body.motivo).trim() : undefined;

  // Un delegado de zona solo puede solicitar ascensos dentro de SU zona.
  let zona: string;
  if (user.role === "delegado_zona") {
    const requested = body.zona ? String(body.zona).trim() : "";
    if (requested && requested !== user.zona) {
      return jsonError("No puedes solicitar ascensos fuera de tu zona", 403);
    }
    zona = user.zona ?? "";
    if (!zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  } else {
    zona = String(body.zona ?? "").trim();
  }

  if (!refereeId || !toLevel || !zona) {
    return jsonError("refereeId, toLevel y zona son obligatorios", 400);
  }

  const req = await dataService.createPromotion({ refereeId, toLevel, zona, motivo });
  return jsonOk(req);
}
