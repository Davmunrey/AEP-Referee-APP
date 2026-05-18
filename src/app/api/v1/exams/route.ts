import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult, ExamType, RefereeLevel } from "@/lib/types";

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
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

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
  if (
    !body.refereeId ||
    !body.tipo ||
    !body.nivelObjetivo ||
    !body.fecha ||
    !body.examinador
  ) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  const scopeErr = await assertRefereeInUserZone(user, body.refereeId);
  if (scopeErr) return scopeErr;
  const puntuacionMaxima =
    body.puntuacionMaxima != null ? Math.max(1, Math.round(body.puntuacionMaxima)) : 100;
  let puntuacion: number | undefined;
  if (body.puntuacion != null) {
    if (typeof body.puntuacion !== "number" || Number.isNaN(body.puntuacion)) {
      return jsonError("Puntuación inválida", 400);
    }
    puntuacion = Math.min(puntuacionMaxima, Math.max(0, Math.round(body.puntuacion)));
  }
  try {
    const exam = await dataService.createExam({
      refereeId: body.refereeId,
      tipo: body.tipo,
      nivelObjetivo: body.nivelObjetivo,
      fecha: body.fecha,
      examinador: body.examinador,
      puntuacion,
      puntuacionMaxima,
      resultado: body.resultado,
      notas: body.notas,
    });
    return jsonOk(exam);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Error", 400);
  }
}
