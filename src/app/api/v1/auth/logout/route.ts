import { clearSessionCookie } from "@/lib/auth/session";
import { jsonOk } from "@/lib/api/route-utils";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
