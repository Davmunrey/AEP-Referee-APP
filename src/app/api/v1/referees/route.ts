import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { Referee } from "@/lib/types";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { searchParams } = new URL(request.url);
  return jsonOk(
    await dataService.getReferees({
      zona: searchParams.get("zona") ?? undefined,
      nivel: searchParams.get("nivel") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      user,
    }),
  );
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "lectura") return jsonError("Sin permiso", 403);

  const body = (await request.json()) as Partial<Referee>;
  if (!body.nombre || !body.zona || !body.nivel || !body.estado) {
    return jsonError("Faltan campos obligatorios", 400);
  }
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
}
