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
    role: "nacional",
    password: "aep2026",
  },
  {
    id: "u-cat",
    nombre: "Marc Vila",
    rol: "Responsable Regional Cataluña",
    iniciales: "MV",
    email: "catalunya@fechap.es",
    role: "regional",
    zona: "CAT",
    password: "aep2026",
  },
  {
    id: "u-and",
    nombre: "Elena Torres",
    rol: "Responsable Regional Andalucía",
    iniciales: "ET",
    email: "andalucia@fechap.es",
    role: "regional",
    zona: "AND",
    password: "aep2026",
  },
  {
    id: "u-read",
    nombre: "Invitado Lectura",
    rol: "Consulta federativa",
    iniciales: "IL",
    email: "lectura@fechap.es",
    role: "lectura",
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
