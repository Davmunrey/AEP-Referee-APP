import { z } from "zod";
import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string; refereeId: string }>;
}

// Valida enums y rangos antes de tocar el claim. Antes se casteaba `status`,
// `travelMode` y los km sin comprobar: un status arbitrario se persistía y
// rompía la máquina de estados; los km podían llegar como string/NaN.
const compensationPatchSchema = z
  .object({
    travelMode: z.enum(["km_rate", "shared_vehicle_passenger", "none"]).optional(),
    distanceKmOneWay: z.number().finite().min(0).max(5000).nullable().optional(),
    distanceKmRoundTrip: z.number().finite().min(0).max(10000).nullable().optional(),
    distanceSource: z.enum(["osm", "google_maps", "manual"]).nullable().optional(),
    travelApproved: z.boolean().optional(),
    travelNotes: z.string().max(1000).nullable().optional(),
    isCompetitionManager: z.boolean().optional(),
    competitionManagerPerDay: z.boolean().optional(),
    isComputerSetup: z.boolean().optional(),
    computerSetupAmount: z.number().finite().min(0).max(100000).nullable().optional(),
    lodgingEligibleOverride: z.boolean().nullable().optional(),
    lodgingDaysOverride: z.number().finite().min(0).max(60).nullable().optional(),
    status: z.enum(["borrador", "enviado", "aprobado", "pagado", "rechazado"]).optional(),
    reviewComment: z.string().max(1000).nullable().optional(),
  });

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id, refereeId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = compensationPatchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Datos de compensación inválidos", 400);

  try {
    const updated = await dataService.updateCompensationClaim(id, refereeId, parsed.data);
    if (!updated) return jsonError("Claim no encontrado para este juez", 404);
    return jsonOk(updated);
  } catch (err) {
    return jsonServerError("compensation.PATCH", err, "No se pudo guardar la compensación");
  }
}
