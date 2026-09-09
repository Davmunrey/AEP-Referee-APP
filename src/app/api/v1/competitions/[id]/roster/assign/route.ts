import {
  RosterPaidClaimError,
  RosterSlotConflictError,
} from "@/lib/competitions/service-types";
import { assignRefereeSchema } from "@/lib/validations";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { loadCompetitionForRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await loadCompetitionForRosterWrite(competitionId, user, "roster.assign");
  if (comp instanceof Response) return comp;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const parsed = assignRefereeSchema.safeParse({
    competitionId,
    slotKey: body.slotKey,
    refereeId: body.refereeId,
    flags: body.flags,
    crossZoneReason: body.crossZoneReason,
    // `undefined` (ausente) desactiva la comprobación; `null` significa «lo vi
    // vacío». Hay que distinguirlos, así que no se normaliza.
    expectedRefereeId: "expectedRefereeId" in body ? body.expectedRefereeId : undefined,
  });
  if (!parsed.success) {
    return jsonError("Datos de asignación inválidos", 400, parsed.error.flatten());
  }

  // Sin `try`, esta llamada dejaba escapar las excepciones: sentar a un juez es
  // la acción más usada de la aplicación, y las lecturas que hace por debajo
  // —tarima, plantilla, liquidaciones pagadas— lanzan cuando la base no
  // responde. Eso salía de Next como un 500 sin cuerpo. Su hermana
  // `roster/clear` ya mapea los mismos casos.
  try {
    const result = await dataService.assignReferee(
      parsed.data.competitionId,
      parsed.data.slotKey,
      parsed.data.refereeId,
      user.nombre,
      parsed.data.flags,
      parsed.data.crossZoneReason,
      parsed.data.expectedRefereeId,
    );
    // 409, no 400: la petición era válida; lo que cambió fue el estado del hueco
    // por debajo. El cliente distingue así «dato mal enviado» de «llegas tarde».
    if (result.conflict) return jsonError(result.error ?? "Conflicto en el hueco", 409);
    if (result.error) return jsonError(result.error, 400);
    return jsonOk({
      assignments: result.assignments,
      flags: result.flags,
      crossZoneMap: result.crossZoneMap,
    });
  } catch (err) {
    if (err instanceof RosterSlotConflictError) return jsonError(err.message, 409);
    if (err instanceof RosterPaidClaimError) return jsonError(err.message, 423);
    return jsonServerError("roster.assign", err, "No se pudo guardar la asignación");
  }
}
