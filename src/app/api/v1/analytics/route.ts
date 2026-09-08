import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  // Paridad con la página y con /analytics/export: sin esto, la API ignoraba
  // `?year=` y devolvía siempre la última temporada.
  const yearParam = new URL(request.url).searchParams.get("year");
  const parsedYear = yearParam ? Number(yearParam) : NaN;
  const requestedYear = Number.isInteger(parsedYear) ? parsedYear : undefined;
  try {
    return jsonOk(await dataService.getAnalytics(user, requestedYear));
  } catch (err) {
    return jsonRouteError("analytics.GET", err, "No se pudieron cargar las estadísticas");
  }
}
