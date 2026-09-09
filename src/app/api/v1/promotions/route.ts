import { zonesMatch } from "@/lib/aep-zones";
import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, readOrError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
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
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

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
  const referee = await readOrError("promotions.POST", "No se pudo cargar el juez", () =>
    dataService.getReferee(refereeId),
  );
  if (referee instanceof Response) return referee;
  if (!referee) return jsonError("Juez no encontrado", 404);
  const zona = referee.zona;

  // Un delegado de zona solo solicita ascensos de jueces de SU zona.
  if (user.role === "delegado_zona" && !zonesMatch(zona, user.zona)) {
    return jsonError("No puedes solicitar ascensos fuera de tu zona", 403);
  }

  try {
    const req = await dataService.createPromotion({ refereeId, toLevel, zona, motivo });
    return jsonOk(req);
  } catch (e) {
    // El servicio lanza errores de validación de negocio con mensaje legible
    // (p. ej. "El nivel destino (…) debe ser superior al actual (…)").
    const msg = e instanceof Error ? e.message : "";
    // «El nivel actual del juez (…) no es reconocible» también lo escribe el
    // servicio para quien pide el ascenso —hay que arreglar el nivel en el
    // censo—, y con el prefijo estrecho moría en un 500 genérico.
    if (msg.startsWith("El nivel") || msg === "Juez no encontrado") {
      return jsonError(msg, 400);
    }
    return jsonServerError("promotions.POST", e, "No se pudo crear la solicitud de ascenso");
  }
}
