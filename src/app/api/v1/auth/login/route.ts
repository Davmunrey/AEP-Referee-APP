import { jsonError } from "@/lib/api/route-utils";

/** Login handled via Supabase Auth OAuth on /sign-in */
export async function POST() {
  return jsonError("Usa /sign-in para iniciar sesión", 410);
}
