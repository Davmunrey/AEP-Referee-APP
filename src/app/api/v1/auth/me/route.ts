import { getSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await getSession();
  if (!user) return jsonError("No autenticado", 401);
  return jsonOk(dataService.getMeta(user));
}
