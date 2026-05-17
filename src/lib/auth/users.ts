import type { SessionUser } from "@/lib/types";

export interface AuthUserRecord extends SessionUser {
  password: string;
}

export const AUTH_USERS: AuthUserRecord[] = [
  {
    id: "u-nacional",
    nombre: "Laura Iglesias",
    rol: "Responsable Nacional de Árbitros",
    iniciales: "LI",
    email: "l.iglesias@fechap.es",
    role: "super_admin",
    password: "aep2026",
  },
  {
    id: "u-jueces",
    nombre: "Hugo Ramírez",
    rol: "Delegado del Comité de Jueces",
    iniciales: "HR",
    email: "jueces@fechap.es",
    role: "delegado_jueces",
    password: "aep2026",
  },
  {
    id: "u-cat",
    nombre: "Marc Vila",
    rol: "Delegado de Zona — Cataluña",
    iniciales: "MV",
    email: "catalunya@fechap.es",
    role: "delegado_zona",
    zona: "CAT",
    password: "aep2026",
  },
  {
    id: "u-and",
    nombre: "Elena Torres",
    rol: "Delegado de Zona — Andalucía",
    iniciales: "ET",
    email: "andalucia@fechap.es",
    role: "delegado_zona",
    zona: "AND",
    password: "aep2026",
  },
  {
    id: "u-read",
    nombre: "Invitado Lectura",
    rol: "Consulta federativa",
    iniciales: "IL",
    email: "lectura@fechap.es",
    role: "solo_ver",
    password: "aep2026",
  },
];

export function findUserByEmail(email: string): AuthUserRecord | undefined {
  return AUTH_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function toSessionUser(user: AuthUserRecord): SessionUser {
  const { password: _password, ...session } = user;
  void _password;
  return session;
}
