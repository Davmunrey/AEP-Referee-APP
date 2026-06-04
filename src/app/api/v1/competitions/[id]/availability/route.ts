import { canEditRoster } from "@/lib/auth/session";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import { z } from "zod";

const bodySchema = z.object({ refereeId: z.string().min(1) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await params;
  const scopeError = await assertCompetitionInUserZone(user, id);
  if (scopeError) return scopeError;
  const confirmedIds = await dataService.getCompetitionAvailability(id);
  return jsonOk({ confirmedIds });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await params;

  // Delegados de zona solo pueden gestionar disponibilidad en su propia zona
  const comp = await dataService.getCompetition(id);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Cuerpo de solicitud inválido", 400);

  try {
    await dataService.addCompetitionAvailability(id, body.data.refereeId, user.nombre);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Error al guardar disponibilidad", 500);
  }
}
