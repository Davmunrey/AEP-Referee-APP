import { jsonOk } from "@/lib/api/route-utils";

/** Logout gestionado por Clerk en el cliente (SignOutButton). */
export async function POST() {
  return jsonOk({ ok: true, message: "Usa el botón Cerrar sesión del panel" });
}
