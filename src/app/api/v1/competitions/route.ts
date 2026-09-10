import { resolveZoneCode } from "@/lib/aep-zones";
import { canCreateCompetition } from "@/lib/permissions";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
import { validateCompetitionFields } from "@/app/api/_lib/validation";
import { dataService } from "@/server/services";
import type { Competition } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  // Sin `catch`, un fallo de lectura salía de Next como un 500 sin sobre
  // `{ data } / { error }`: el cliente enseñaba el texto genérico por código
  // de estado y en el servidor no quedaba ni una línea diciendo QUÉ lectura se
  // había caído. Las listas de esta misma API que sí lo tienen —aprobaciones,
  // tickets— son las que se pueden diagnosticar.
  const leido = await readOrError("competitions.GET", "No se pudo cargar el calendario", () =>
    dataService.getCompetitions(user),
  );
  if (leido instanceof Response) return leido;
  return jsonOk(leido);
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
  const sesiones = Math.round(Number(body.sesiones ?? 3));
  const requeridos = Math.round(Number(body.requeridos ?? 9));
  // Validación compartida con el PATCH de /competitions/[id]:
  // enum de tipo, formato de fechas, fechaFin >= fecha y rangos numéricos.
  const validationError = validateCompetitionFields({
    tipo: body.tipo,
    fecha: body.fecha,
    fechaFin: body.fechaFin,
    sesiones,
    requeridos,
  });
  if (validationError) return jsonError(validationError, 400);

  // Un delegado de zona solo puede crear competiciones en SU zona.
  // Solo el super_admin puede asignar una zona arbitraria.
  let zona: string;
  if (user.role === "delegado_zona") {
    // Se comparan códigos canónicos: los alias de zona («Centro», «MAD») son
    // válidos en el resto de la aplicación, y comparados en crudo rechazaban
    // como «fuera de tu zona» una competición de la zona propia.
    const userZone = resolveZoneCode(user.zona ?? "") ?? user.zona ?? "";
    if (body.zona && resolveZoneCode(String(body.zona)) !== userZone) {
      return jsonError("No puedes crear competiciones fuera de tu zona", 403);
    }
    zona = userZone;
    if (!zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  } else {
    // Una zona no reconocida se normalizaba a null en el servicio: la
    // competición nacía invisible para todos los delegados de zona.
    if (body.zona && !resolveZoneCode(String(body.zona))) {
      return jsonError("Zona no válida", 400);
    }
    zona = body.zona ?? "";
  }

  try {
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
  } catch (e) {
    // El servicio lanza un Error legible cuando detecta un duplicado
    // (mismo nombre+fecha+tipo) → conflicto, no error interno.
    if (e instanceof Error && e.message.startsWith("Ya existe un campeonato")) {
      return jsonError(e.message, 409);
    }
    return jsonServerError("competitions.POST", e, "No se pudo crear el campeonato");
  }
}
