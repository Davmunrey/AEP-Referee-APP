import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { searchPhotonAddresses } from "@/lib/geocoding/photon-search";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return jsonOk({ suggestions: [] });
  }
  if (q.length > 200) {
    return jsonError("Consulta demasiado larga", 400);
  }

  try {
    const suggestions = await searchPhotonAddresses(q);
    return jsonOk({ suggestions });
  } catch (err) {
    console.error("[geocode/search] Photon falló:", err instanceof Error ? err.message : err);
    return jsonError("No se pudo buscar la dirección. Inténtalo de nuevo.", 502);
  }
}
