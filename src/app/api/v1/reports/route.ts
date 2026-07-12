import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { canManageJudges } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ReportSubjectType, ReportType } from "@/lib/types";

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
  if (!body.subjectType || !body.titulo || !body.tipo || !body.contenido) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  let zona: string | undefined;
  if (body.subjectType === "juez") {
    if (!body.refereeId) return jsonError("Juez obligatorio", 400);
    const scopeErr = await assertRefereeInUserZone(user, body.refereeId);
    if (scopeErr) return scopeErr;
  } else {
    if (!body.competitionId) return jsonError("Competición obligatoria", 400);
    const competition = await dataService.getCompetition(body.competitionId);
    if (!competition) return jsonError("Competición no encontrada", 404);
    if (user.role === "delegado_zona" && user.zona && competition.zona !== user.zona) {
      return jsonError("Fuera de tu zona", 403);
    }
    zona = competition.zona;
  }
  try {
    const report = await dataService.createReport({
      subjectType: body.subjectType,
      zona: zona ?? user.zona ?? "NACIONAL",
      refereeId: body.refereeId,
      competitionId: body.competitionId,
      titulo: body.titulo,
      tipo: body.tipo,
      evento: body.evento,
      contenido: body.contenido,
      adjuntoUrl: body.adjuntoUrl,
      autor: user.nombre,
    });
    return jsonOk(report);
  } catch (err) {
    return jsonServerError("reports.POST", err, "No se pudo crear el informe");
  }
}
