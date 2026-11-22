/**
 * Arnés común de los tests de rutas de la API: una sesión de cada rol y
 * constructores de peticiones. Los `vi.mock` van en cada fichero de test
 * (Vitest solo los eleva allí); este módulo no mockea nada.
 */
import type { SessionUser } from "@/lib/types";

const base = (role: SessionUser["role"], extra: Partial<SessionUser> = {}): SessionUser => ({
  id: `u-${role}`,
  email: `${role}@aep.test`,
  nombre: `Usuario ${role}`,
  rol: role,
  iniciales: "US",
  role,
  ...extra,
});

export const usuarios = {
  admin: base("super_admin"),
  nacional: base("delegado_jueces"),
  zona: base("delegado_zona", { id: "u-zona", zona: "CENTRO" }),
  otraZona: base("delegado_zona", { id: "u-otra-zona", zona: "NOROESTE" }),
  zonaSinZona: base("delegado_zona", { id: "u-sin-zona", zona: undefined }),
  lectura: base("solo_ver"),
  financiero: base("responsable_financiero_jueces"),
} as const;

export const juez: SessionUser & { refereeId: string } = {
  ...base("juez", { id: "u-juez", zona: "CENTRO" }),
  refereeId: "j1",
};

/** Respuesta de «no autenticado» tal cual la devuelve `requireApiUser`. */
export const sinSesion = () =>
  new Response(JSON.stringify({ error: "No autenticado" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });

export const peticion = (body?: unknown, method = "POST", url = "http://localhost/api") =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

export const get = (url = "http://localhost/api") => new Request(url, { method: "GET" });

export const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

export async function cuerpo<T = unknown>(res: Response): Promise<{ data?: T; error?: string }> {
  return (await res.json()) as { data?: T; error?: string };
}

/** Campeonato de la zona CENTRO, futuro y sin aprobar: se puede editar. */
export const campeonato = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  nombre: "Copa Centro",
  tipo: "AEP-3",
  zona: "CENTRO",
  fecha: "2099-06-01",
  fechaFin: "2099-06-01",
  sede: "Madrid",
  sesiones: 1,
  requeridos: 2,
  aprobacion: "Borrador",
  ...extra,
});
