import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { Competition } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  return jsonOk(await dataService.getCompetitions(user));
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver" || user.role === "delegado_jueces")
    return jsonError("Sin permiso", 403);

  const body = (await request.json()) as Partial<Competition>;
  if (!body.nombre || !body.tipo || !body.fecha || !body.fechaFin || !body.sede) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  const comp = await dataService.createCompetition({
    nombre: body.nombre,
    tipo: body.tipo,
    fecha: body.fecha,
    fechaFin: body.fechaFin,
    sede: body.sede,
    sesiones: body.sesiones ?? 3,
    requeridos: body.requeridos ?? 9,
    zona: body.zona ?? user.zona ?? "",
  });
  return jsonOk(comp);
}
