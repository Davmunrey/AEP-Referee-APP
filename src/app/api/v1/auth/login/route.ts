import { jsonError } from "@/lib/api/route-utils";

/** Login vía Clerk en /sign-in */
export async function POST() {
  return jsonError("Usa /sign-in para iniciar sesión con Clerk", 410);
}
