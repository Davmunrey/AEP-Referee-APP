import { isLocalOnly } from "@/lib/runtime";
import type { SessionUser, UserRole } from "@/lib/types";
import { AUTH_USERS, toSessionUser } from "./users";

export function isDemoMode(): boolean {
  return isLocalOnly() || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export interface DemoPersona {
  id: string;
  label: string;
  subtitle: string;
  org: string;
  role: UserRole;
  zona?: string;
  email: string;
}

const ORG_LABELS: Record<UserRole, string> = {
  nacional: "AEP Nacional",
  regional: "AEP Regional",
  lectura: "AEP Consulta",
};

export const DEMO_PERSONAS: DemoPersona[] = AUTH_USERS.map((u) => ({
  id: u.id,
  label: u.nombre,
  subtitle: u.rol,
  org:
    u.role === "regional" && u.zona
      ? `${ORG_LABELS.regional} · ${u.zona}`
      : ORG_LABELS[u.role],
  role: u.role,
  zona: u.zona,
  email: u.email,
}));

export function findDemoPersona(userId: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.id === userId);
}

export function switchToPersona(userId: string): SessionUser | undefined {
  const record = AUTH_USERS.find((u) => u.id === userId);
  if (!record) return undefined;
  return toSessionUser(record);
}

export function personaForSession(user: SessionUser): DemoPersona {
  return (
    DEMO_PERSONAS.find((p) => p.id === user.id) ??
    DEMO_PERSONAS.find((p) => p.email === user.email) ?? {
      id: user.id,
      label: user.nombre,
      subtitle: user.rol,
      org: ORG_LABELS.nacional,
      role: user.role,
      zona: user.zona,
      email: user.email,
    }
  );
}
