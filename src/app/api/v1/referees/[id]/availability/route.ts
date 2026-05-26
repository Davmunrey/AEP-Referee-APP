import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const addSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(500).optional(),
});

export async function GET(_req: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const periods = await dataService.getRefereeAvailability(id);
  return jsonOk({ periods });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonError("Datos inválidos", 400, parsed.error.flatten());
  if (parsed.data.fechaFin < parsed.data.fechaInicio) {
    return jsonError("La fecha fin debe ser igual o posterior a la fecha inicio", 400);
  }

  const period = await dataService.addRefereeUnavailability(id, parsed.data, user.nombre);
  return jsonOk({ period });
}
