import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { ReportType } from "@/lib/types";

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
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const body = (await request.json().catch(() => null)) as {
    refereeId?: string;
    titulo?: string;
    tipo?: ReportType;
    evento?: string;
    contenido?: string;
    adjuntoUrl?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  if (!body.refereeId || !body.titulo || !body.tipo || !body.contenido) {
    return jsonError("Faltan campos obligatorios", 400);
  }
  try {
    const report = await dataService.createReport({
      refereeId: body.refereeId,
      titulo: body.titulo,
      tipo: body.tipo,
      evento: body.evento,
      contenido: body.contenido,
      adjuntoUrl: body.adjuntoUrl,
      autor: user.nombre,
    });
    return jsonOk(report);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Error", 400);
  }
}
