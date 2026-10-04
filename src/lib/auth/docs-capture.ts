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

/**
 * Cookie con la que el modo captura se presenta como juez en vez de como super
 * admin, para poder ver y capturar el portal sin Supabase. Solo se lee con el
 * modo captura activo, que nunca lo está en producción.
 */
export const DOCS_CAPTURE_ROLE_COOKIE = "aep-captura-rol";

/** Juez de la semilla de capturas (`docs-capture-seed`, ficha `j001`). */
export const DOCS_CAPTURE_JUDGE_REFEREE_ID = "j001";

export function docsCaptureJudgeSession(): SessionUser {
  return {
    id: "docs-capture-juez",
    email: "ana.roa@example.test",
    nombre: "Ana Roa Sales",
    rol: "Juez",
    iniciales: "AR",
    role: "juez",
    zona: "MEDITERRANEO",
    refereeId: DOCS_CAPTURE_JUDGE_REFEREE_ID,
  };
}

export async function docsCaptureAsJudge(): Promise<boolean> {
  if (!isDocsCaptureMode()) return false;
  const { cookies } = await import("next/headers");
  return (await cookies()).get(DOCS_CAPTURE_ROLE_COOKIE)?.value === "juez";
}

export function isDocsCaptureMode(): boolean {
  // Nunca en producción: el modo captura devuelve una sesión super_admin sin
  // credenciales; un flag mal puesto en prod no debe poder abrir la app.
  return (
    process.env.AEP_DOCS_CAPTURE === "1" && process.env.NODE_ENV !== "production"
  );
}
