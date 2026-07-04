import { canCreateCompetition } from "@/lib/permissions";
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
  if (!canCreateCompetition(user.role)) return jsonError("Sin permiso", 403);

  const body = (await request.json().catch(() => null)) as Partial<Competition> | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  if (!body.nombre || !body.tipo || !body.fecha || !body.fechaFin || !body.sede) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  if (body.fechaFin < body.fecha) {
    return jsonError("La fecha de fin no puede ser anterior a la de inicio", 400);
  }
  const sesiones = Math.round(Number(body.sesiones ?? 3));
  const requeridos = Math.round(Number(body.requeridos ?? 9));
  if (!Number.isFinite(sesiones) || sesiones < 1 || sesiones > 6) {
    return jsonError("Las sesiones deben estar entre 1 y 6", 400);
  }
  if (!Number.isFinite(requeridos) || requeridos < 1) {
    return jsonError("Las plazas requeridas deben ser al menos 1", 400);
  }

  // Un delegado de zona solo puede crear competiciones en SU zona.
  // Solo el super_admin puede asignar una zona arbitraria.
  let zona: string;
  if (user.role === "delegado_zona") {
    if (body.zona && body.zona !== user.zona) {
      return jsonError("No puedes crear competiciones fuera de tu zona", 403);
    }
    zona = user.zona ?? "";
    if (!zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  } else {
    zona = body.zona ?? "";
  }

  const comp = await dataService.createCompetition({
    nombre: body.nombre,
    tipo: body.tipo,
    fecha: body.fecha,
    fechaFin: body.fechaFin,
    sede: body.sede,
    sesiones,
    requeridos,
    zona,
  });
  return jsonOk(comp);
}
