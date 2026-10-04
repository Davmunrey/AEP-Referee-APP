import { z } from "zod";
import { zonesMatch } from "@/lib/aep-zones";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
import { canManageJudges } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { getJudgeAccessStatuses, issueAccessCodes } from "@/server/services/judge-accounts";

const bodySchema = z.object({ refereeIds: z.array(z.string().min(1)).min(1).max(200) });

/**
 * Da acceso al portal a una o varias fichas del censo: crea la cuenta si no
 * la tienen y genera un código para cada una (que solo vuelve en esta
 * respuesta). El delegado de zona, solo a los jueces de su zona.
 */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Indica entre 1 y 200 jueces", 400);

  const byId = await readOrError("portal-access.POST", "No se pudieron cargar los jueces", () =>
    dataService.getRefereesByIds(body.data.refereeIds),
  );
  if (byId instanceof Response) return byId;
  const referees = [...byId.values()];
  if (user.role === "delegado_zona") {
    // Fail-closed: sin zona propia, o con un juez de otra zona en la lista, no
    // se da acceso a nadie (y no solo a los de fuera).
    if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
    if (referees.some((r) => !zonesMatch(r.zona, user.zona))) {
      return jsonError("Solo puedes dar acceso a jueces de tu zona", 403);
    }
  }

  try {
    const results = await issueAccessCodes(referees, user.id);
    const missing = body.data.refereeIds.filter((id) => !byId.has(id));
    return jsonOk({
      results: [
        ...results,
        ...missing.map((refereeId) => ({ refereeId, nombre: refereeId, outcome: "no-encontrado" as const })),
      ],
    });
  } catch (err) {
    return jsonServerError("portal-access.POST", err, "No se pudieron generar los códigos");
  }
}

/** Estado de acceso al portal de las fichas indicadas (`?ids=a,b,c`). */
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 2000);
  if (ids.length === 0) return jsonOk({ statuses: {}, codeExpiry: {} });
  try {
    const byId = await dataService.getRefereesByIds(ids);
    const visible = [...byId.values()].filter(
      (r) => user.role !== "delegado_zona" || (user.zona && zonesMatch(r.zona, user.zona)),
    );
    return jsonOk(await getJudgeAccessStatuses(visible));
  } catch (err) {
    return jsonServerError("portal-access.GET", err, "No se pudo cargar el acceso al portal");
  }
}
