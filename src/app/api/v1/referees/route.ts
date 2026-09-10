import { zonesMatch } from "@/lib/aep-zones";
import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { stripRefereeListPII } from "@/lib/api/referee-scope";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
import {
  REFEREE_LEVELS,
  REFEREE_STATUSES,
  isRefereeLevel,
  isRefereeStatus,
} from "@/app/api/_lib/validation";
import { dataService } from "@/server/services";
import type { Referee } from "@/lib/types";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { searchParams } = new URL(request.url);
  // Ver `competitions.GET`: sin esto el fallo de lectura salía como un 500 sin
  // sobre y sin nombre en el log.
  const referees = await readOrError("referees.list.GET", "No se pudo cargar el censo", () =>
    dataService.getReferees({
      zona: searchParams.get("zona") ?? undefined,
      nivel: searchParams.get("nivel") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      user,
    }),
  );
  if (referees instanceof Response) return referees;
  return jsonOk(stripRefereeListPII(referees, user));
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

  const body = (await request.json().catch(() => null)) as Partial<Referee> | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  if (!body.nombre || !body.zona || !body.nivel || !body.estado) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  if (!isRefereeLevel(body.nivel)) {
    return jsonError(
      `Nivel no válido. Valores permitidos: ${REFEREE_LEVELS.join(", ")}`,
      400,
    );
  }
  if (!isRefereeStatus(body.estado)) {
    return jsonError(
      `Estado no válido. Valores permitidos: ${REFEREE_STATUSES.join(", ")}`,
      400,
    );
  }
  // delegado_zona solo puede crear jueces en su propia zona
  if (user.role === "delegado_zona") {
    if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
    // Códigos canónicos: un alias válido de su propia zona («2- CENTRO») se
    // rechazaba como si fuera otra.
    if (!zonesMatch(body.zona, user.zona)) {
      return jsonError("Solo puedes crear jueces en tu zona", 403);
    }
  }
  try {
    const referee = await dataService.createReferee({
      nombre: body.nombre,
      zona: body.zona,
      nivel: body.nivel,
      estado: body.estado,
      eventos: body.eventos ?? 0,
      ultimo: body.ultimo ?? "—",
      disp: body.disp ?? true,
      email: body.email,
      licencia: body.licencia,
    });
    return jsonOk(referee);
  } catch (e) {
    // 23505 = unique_violation en Postgres (p. ej. id generado ya ocupado):
    // conflicto reintentable, no error interno.
    if ((e as { code?: string } | null)?.code === "23505") {
      return jsonError("Ya existe un juez con esos datos. Vuelve a intentarlo.", 409);
    }
    return jsonServerError("referees.POST", e, "No se pudo crear el juez");
  }
}
