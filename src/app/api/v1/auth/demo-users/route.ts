import { DEMO_PERSONAS, isDemoMode } from "@/lib/auth/demo";
import { jsonError, jsonOk } from "@/lib/api/route-utils";

export async function GET() {
  if (!isDemoMode()) {
    return jsonError("Demo no habilitado", 403);
  }
  return jsonOk(DEMO_PERSONAS);
}
