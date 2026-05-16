import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ExamResult, ExamType, RefereeLevel } from "@/lib/types";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { searchParams } = new URL(request.url);
  return jsonOk(
    await dataService.getExams(searchParams.get("refereeId") ?? undefined),
  );
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "lectura") return jsonError("Sin permiso", 403);

  const body = (await request.json()) as {
    refereeId?: string;
    tipo?: ExamType;
    nivelObjetivo?: RefereeLevel;
    fecha?: string;
    examinador?: string;
    puntuacion?: number;
    puntuacionMaxima?: number;
    resultado?: ExamResult;
    notas?: string;
  };
  if (
    !body.refereeId ||
    !body.tipo ||
    !body.nivelObjetivo ||
    !body.fecha ||
    !body.examinador
  ) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  try {
    const exam = await dataService.createExam({
      refereeId: body.refereeId,
      tipo: body.tipo,
      nivelObjetivo: body.nivelObjetivo,
      fecha: body.fecha,
      examinador: body.examinador,
      puntuacion: body.puntuacion,
      puntuacionMaxima: body.puntuacionMaxima,
      resultado: body.resultado,
      notas: body.notas,
    });
    return jsonOk(exam);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Error", 400);
  }
}
