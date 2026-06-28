import type { SessionUser } from "@/lib/types";

/** Solo activo con AEP_DOCS_CAPTURE=1 (script de capturas / dev local sin Supabase). */
export const DOCS_CAPTURE_SESSION: SessionUser = {
  id: "docs-capture",
  email: "captura@aep-tarima.local",
  nombre: "AEP Nacional",
  rol: "Super Admin",
  iniciales: "AN",
  role: "super_admin",
};

export function isDocsCaptureMode(): boolean {
  return process.env.AEP_DOCS_CAPTURE === "1";
}
