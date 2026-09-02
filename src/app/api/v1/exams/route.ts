import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult, ExamType, RefereeLevel } from "@/lib/types";

const EXAM_TYPES: ReadonlyArray<ExamType> = ["Nuevo juez", "Ascenso IPF", "Recertificación"];
const EXAM_RESULTS: ReadonlyArray<ExamResult> = ["Aprobado", "Suspenso", "Pendiente"];
const REFEREE_LEVELS: ReadonlyArray<RefereeLevel> = [
  "Regional",
  "Nacional",
  "IPF Cat. 1",
  "IPF Cat. 2",
];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { searchParams } = new URL(request.url);
  return jsonOk(
    await dataService.getExams(
      searchParams.get("refereeId") ?? undefined,
      user,
    ),
  );
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

  const body = (await request.json().catch(() => null)) as {
    refereeId?: string;
    tipo?: ExamType;
    nivelObjetivo?: RefereeLevel;
    fecha?: string;
    examinador?: string;
    puntuacion?: number;
    puntuacionMaxima?: number;
    resultado?: ExamResult;
    notas?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  // Valida tipos y enums ANTES de llegar al servicio: sin esto, un `tipo`
  // desconocido pasaba `validateExamLevel` sin caer en ninguna rama y se
  // persistía, y una fecha no ISO reventaba en Postgres como 500.
  if (
    typeof body.refereeId !== "string" ||
    !body.refereeId ||
    typeof body.fecha !== "string" ||
    !body.fecha ||
    typeof body.examinador !== "string" ||
    !body.examinador.trim()
  ) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  if (!EXAM_TYPES.includes(body.tipo as ExamType)) {
    return jsonError("Tipo de examen no válido", 400);
  }
  if (!REFEREE_LEVELS.includes(body.nivelObjetivo as RefereeLevel)) {
    return jsonError("Nivel objetivo no válido", 400);
  }
  if (body.resultado !== undefined && !EXAM_RESULTS.includes(body.resultado as ExamResult)) {
    return jsonError("Resultado no válido", 400);
  }
  if (!ISO_DATE_RE.test(body.fecha)) {
    return jsonError("La fecha debe tener formato AAAA-MM-DD", 400);
  }
  if (body.notas !== undefined && typeof body.notas !== "string") {
    return jsonError("Notas no válidas", 400);
  }
  const scopeErr = await assertRefereeInUserZone(user, body.refereeId);
  if (scopeErr) return scopeErr;
  if (
    body.puntuacionMaxima != null &&
    (typeof body.puntuacionMaxima !== "number" || !Number.isFinite(body.puntuacionMaxima))
  ) {
    return jsonError("Puntuación máxima inválida", 400);
  }
  const puntuacionMaxima =
    body.puntuacionMaxima != null ? Math.max(1, Math.round(body.puntuacionMaxima)) : 100;
  let puntuacion: number | undefined;
  if (body.puntuacion != null) {
    if (typeof body.puntuacion !== "number" || !Number.isFinite(body.puntuacion)) {
      return jsonError("Puntuación inválida", 400);
    }
    puntuacion = Math.min(puntuacionMaxima, Math.max(0, Math.round(body.puntuacion)));
  }
  try {
    const exam = await dataService.createExam({
      refereeId: body.refereeId,
      tipo: body.tipo as ExamType,
      nivelObjetivo: body.nivelObjetivo as RefereeLevel,
      fecha: body.fecha,
      examinador: body.examinador,
      puntuacion,
      puntuacionMaxima,
      resultado: body.resultado,
      notas: body.notas,
    });
    return jsonOk(exam);
  } catch (err) {
    // El servicio expresa reglas de negocio lanzando Error con mensaje claro
    // (juez inexistente, nivel objetivo incompatible): son 404/400, no 500.
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Juez no encontrado") return jsonError(msg, 404);
    if (/^(Nuevo juez|Ascenso IPF|Recertificación)/.test(msg)) return jsonError(msg, 400);
    return jsonServerError("exams.POST", err, "No se pudo crear el examen");
  }
}
