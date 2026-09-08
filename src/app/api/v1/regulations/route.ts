import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  try {
    return jsonOk(await dataService.getRegulations());
  } catch (err) {
    return jsonRouteError("regulations.GET", err, "No se pudo cargar la normativa");
  }
}
