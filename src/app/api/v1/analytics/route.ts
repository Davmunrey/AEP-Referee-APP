import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  return jsonOk(await dataService.getAnalytics(user));
}
