import { auth, currentUser } from "@clerk/nextjs/server";
import { profileToSessionUser, type ProfileRow } from "@/lib/auth/profile";
import { isClerkConfigured } from "@/lib/clerk/env";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { SessionUser } from "@/lib/types";

export async function getSession(): Promise<SessionUser | null> {
  if (!isClerkConfigured() || !isSupabaseConfigured()) return null;

  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, nombre, rol_label, iniciales, role, zona, activo")
    .eq("id", userId)
    .single();

  if (error || !profile || !profile.activo) return null;
  return profileToSessionUser(profile as ProfileRow);
}

/** Email del usuario Clerk (p. ej. alta de perfiles). */
export async function getClerkPrimaryEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress ?? null;
}

export function canEditRoster(user: SessionUser, eventZona?: string): boolean {
  if (user.role === "lectura") return false;
  if (user.role === "nacional") return true;
  return user.zona === eventZona;
}

export function canApprove(user: SessionUser): boolean {
  return user.role === "nacional";
}

export function canManageUsers(user: SessionUser): boolean {
  return user.role === "nacional";
}
