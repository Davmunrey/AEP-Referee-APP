import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ReportSubjectType, ReportType } from "@/lib/types";

const REPORT_TIPOS: ReadonlyArray<ReportType> = [
  "General",
  "Competición",
  "Juez",
  "Incidencia",
  "Evaluación",
];
const SUBJECT_TYPES: ReadonlyArray<ReportSubjectType> = ["competicion", "juez"];

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { searchParams } = new URL(request.url);
  return jsonOk(
    await dataService.getReports(
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
    subjectType?: ReportSubjectType;
    refereeId?: string;
    competitionId?: string;
    titulo?: string;
    tipo?: ReportType;
    evento?: string;
    contenido?: string;
    adjuntoUrl?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  // Enums y tipos validados ANTES del servicio: cualquier `subjectType` ≠ "juez"
  // caía en la rama de competición y se persistía tal cual ("foo"), igual que
  // un `tipo` inventado; y `titulo: 1` pasaba el check de obligatorio.
  if (!SUBJECT_TYPES.includes(body.subjectType as ReportSubjectType)) {
    return jsonError("Tipo de sujeto no válido", 400);
  }
  if (!REPORT_TIPOS.includes(body.tipo as ReportType)) {
    return jsonError("Tipo de informe no válido", 400);
  }
  if (
    typeof body.titulo !== "string" ||
    !body.titulo.trim() ||
    typeof body.contenido !== "string" ||
    !body.contenido.trim()
  ) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  if (
    (body.evento !== undefined && typeof body.evento !== "string") ||
    (body.adjuntoUrl !== undefined && typeof body.adjuntoUrl !== "string")
  ) {
    return jsonError("Campos de texto no válidos", 400);
  }
  let zona: string | undefined;
  if (body.subjectType === "juez") {
    if (typeof body.refereeId !== "string" || !body.refereeId) {
      return jsonError("Juez obligatorio", 400);
    }
    // Juez inexistente: 404 explícito (el servicio lo lanzaba como 500).
    const referee = await dataService.getReferee(body.refereeId);
    if (!referee) return jsonError("Juez no encontrado", 404);
    const scopeErr = await assertRefereeInUserZone(user, body.refereeId);
    if (scopeErr) return scopeErr;
  } else {
    if (typeof body.competitionId !== "string" || !body.competitionId) {
      return jsonError("Competición obligatoria", 400);
    }
    const competition = await dataService.getCompetition(body.competitionId);
    if (!competition) return jsonError("Competición no encontrada", 404);
    if (user.role === "delegado_zona" && user.zona && competition.zona !== user.zona) {
      return jsonError("Fuera de tu zona", 403);
    }
    zona = competition.zona;
  }
  try {
    const report = await dataService.createReport({
      subjectType: body.subjectType as ReportSubjectType,
      zona: zona ?? user.zona ?? "NACIONAL",
      refereeId: body.refereeId,
      competitionId: body.competitionId,
      titulo: body.titulo,
      tipo: body.tipo as ReportType,
      evento: body.evento,
      contenido: body.contenido,
      adjuntoUrl: body.adjuntoUrl,
      autor: user.nombre,
    });
    return jsonOk(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Juez no encontrado" || msg === "Competición no encontrada") {
      return jsonError(msg, 404);
    }
    return jsonServerError("reports.POST", err, "No se pudo crear el informe");
  }
}
