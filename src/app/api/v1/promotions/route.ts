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

  if (!refereeId || !toLevel) {
    return jsonError("refereeId y toLevel son obligatorios", 400);
  }

  // La zona se deriva SIEMPRE del juez, nunca del body (anti-IDOR).
  const referee = await dataService.getReferee(refereeId);
  if (!referee) return jsonError("Juez no encontrado", 404);
  const zona = referee.zona;

  // Un delegado de zona solo solicita ascensos de jueces de SU zona.
  if (user.role === "delegado_zona" && zona !== user.zona) {
    return jsonError("No puedes solicitar ascensos fuera de tu zona", 403);
  }

  const req = await dataService.createPromotion({ refereeId, toLevel, zona, motivo });
  return jsonOk(req);
}
