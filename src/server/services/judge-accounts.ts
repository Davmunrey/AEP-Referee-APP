/**
 * Cuentas de juez para el portal.
 *
 * Un juez entra con un enlace que le llega al e-mail que figura en su ficha
 * del censo (sin contraseña que recordar). La cuenta se crea de dos maneras:
 *
 *  · un delegado la invita desde el directorio (una o muchas a la vez);
 *  · el propio juez la pide escribiendo su e-mail en la pantalla de acceso; si
 *    coincide con el de una ficha, recibe el mismo enlace.
 *
 * Nadie que no esté en el censo puede tener cuenta de juez, y el e-mail es
 * siempre el de la ficha: la aplicación nunca envía un enlace a una dirección
 * que haya escrito quien pide el acceso sin comprobarla antes contra el censo.
 *
 * Retirar el acceso desactiva el perfil y conserva el enlace con la ficha, así
 * que volver a invitar reactiva la misma cuenta. Como `getSession` relee el
 * perfil en cada petición, el acceso se corta en el acto.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveZoneCode } from "@/lib/aep-zones";
import { getStore } from "@/server/store";
import { mapReferee } from "@/server/db/mappers";
import type { JudgeAccessStatus, JudgeInviteOutcome, JudgeInviteResult } from "@/lib/judge-access";
import type { Referee } from "@/lib/types";

export type { JudgeAccessStatus, JudgeInviteOutcome, JudgeInviteResult } from "@/lib/judge-access";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initialsOf(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : nombre.slice(0, 2)).toUpperCase();
}

/**
 * Envía el enlace de acceso. Con la clave pública y sin crear usuario: si la
 * cuenta no existe, Supabase no envía nada.
 */
async function sendMagicLink(email: string, redirectTo: string): Promise<boolean> {
  const anon = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (error) console.error("[judge-accounts.magic-link]", error.message);
  return !error;
}

// ── Memoria (dev sin Supabase) ─────────────────────────────────────────────
// Sin servicio de correo ni auth: se simula el enlace ficha↔cuenta para poder
// probar el directorio y el portal en local.
const memoryActive = new Map<string, boolean>();

/** ¿Cuenta de juez activa? (memoria; en Supabase lo dice `profiles.activo`). */
export function isMemoryJudgeAccountActive(userId: string): boolean {
  return memoryActive.get(userId) !== false;
}

function memoryInvite(referee: Referee): JudgeInviteOutcome {
  if (!referee.email || !EMAIL_RE.test(referee.email)) return "sin-email";
  const store = getStore();
  const row = store.referees.find((r) => r.id === referee.id);
  if (!row) return "no-encontrado";
  if (row.userId) {
    const wasActive = memoryActive.get(row.userId) !== false;
    memoryActive.set(row.userId, true);
    return wasActive ? "enlace-reenviado" : "reactivado";
  }
  row.userId = `mem-juez-${row.id}`;
  memoryActive.set(row.userId, true);
  return "invitado";
}

// ── Supabase ───────────────────────────────────────────────────────────────

async function supabaseInvite(referee: Referee, redirectTo: string): Promise<JudgeInviteOutcome> {
  const email = referee.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return "sin-email";
  const admin = createAdminClient();

  if (referee.userId) {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, activo, role")
      .eq("id", referee.userId)
      .maybeSingle();
    if (error) throw new Error(`profiles: ${error.message}`);
    if (profile && profile.role === "juez") {
      if (!profile.activo) {
        const { error: upErr } = await admin.from("profiles").update({ activo: true }).eq("id", profile.id);
        if (upErr) throw new Error(`profiles: ${upErr.message}`);
        return (await sendMagicLink(email, redirectTo)) ? "reactivado" : "error";
      }
      return (await sendMagicLink(email, redirectTo)) ? "enlace-reenviado" : "error";
    }
    // Enlace a un perfil que ya no existe o que no es de juez: se trata como
    // si no tuviera cuenta, pero sin pisar el enlace a ciegas (ver abajo).
  }

  // El e-mail de la ficha ya es de otra cuenta: casi siempre un delegado que
  // también es juez. No se le cambia el rol a esa cuenta por la puerta de atrás.
  const { data: taken, error: takenErr } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
    .limit(1);
  if (takenErr) throw new Error(`profiles: ${takenErr.message}`);
  if ((taken ?? []).length > 0) return "email-en-uso";

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: referee.nombre },
  });
  if (inviteErr || !invited.user) {
    const code = (inviteErr as { code?: string } | null)?.code ?? "";
    if (code === "email_exists" || /already (been )?registered|already exists/i.test(inviteErr?.message ?? "")) {
      return "email-en-uso";
    }
    console.error("[judge-accounts.invite]", inviteErr?.message);
    return "error";
  }
  const userId = invited.user.id;

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    email,
    nombre: referee.nombre,
    rol_label: "Juez",
    iniciales: initialsOf(referee.nombre),
    role: "juez",
    zona: resolveZoneCode(referee.zona) ?? null,
    activo: true,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    throw new Error(`profiles: ${profileErr.message}`);
  }

  // Enlace condicional: si otro delegado invitó a la vez al mismo juez, gana
  // el primero y esta cuenta sobrante se borra.
  const { data: linked, error: linkErr } = await admin
    .from("referees")
    .update({ user_id: userId })
    .eq("id", referee.id)
    .is("user_id", null)
    .select("id");
  if (linkErr || (linked ?? []).length === 0) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => null);
    if (linkErr) throw new Error(`referees: ${linkErr.message}`);
    return "enlace-reenviado";
  }
  return "invitado";
}

/** Invita (o reenvía el enlace) a las fichas indicadas. */
export async function inviteJudges(referees: Referee[], redirectTo: string): Promise<JudgeInviteResult[]> {
  const results: JudgeInviteResult[] = [];
  // En serie: son pocas decenas como mucho, y en paralelo el servicio de
  // correo de Supabase corta por límite de envíos.
  for (const referee of referees) {
    let outcome: JudgeInviteOutcome;
    try {
      outcome = isSupabaseConfigured() ? await supabaseInvite(referee, redirectTo) : memoryInvite(referee);
    } catch (err) {
      console.error("[judge-accounts.inviteJudges]", err);
      outcome = "error";
    }
    results.push({ refereeId: referee.id, nombre: referee.nombre, email: referee.email, outcome });
  }
  return results;
}

/** Retira el acceso al portal. Devuelve `false` si el juez no tenía cuenta. */
export async function revokeJudgeAccess(referee: Referee): Promise<boolean> {
  if (!referee.userId) return false;
  if (!isSupabaseConfigured()) {
    memoryActive.set(referee.userId, false);
    return true;
  }
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ activo: false })
    .eq("id", referee.userId)
    .eq("role", "juez")
    .select("id");
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Estado de acceso al portal de cada ficha. */
export async function getJudgeAccessStatuses(referees: Referee[]): Promise<Record<string, JudgeAccessStatus>> {
  const out: Record<string, JudgeAccessStatus> = {};
  const linked = referees.filter((r) => r.userId);
  for (const r of referees) out[r.id] = "sin-acceso";
  if (linked.length === 0) return out;
  if (!isSupabaseConfigured()) {
    for (const r of linked) out[r.id] = memoryActive.get(r.userId!) === false ? "revocado" : "con-acceso";
    return out;
  }
  const ids = linked.map((r) => r.userId!);
  const active = new Map<string, boolean>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("id, activo, role")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`profiles: ${error.message}`);
    for (const p of data ?? []) if (p.role === "juez") active.set(String(p.id), Boolean(p.activo));
  }
  for (const r of linked) {
    const a = active.get(r.userId!);
    out[r.id] = a === undefined ? "sin-acceso" : a ? "con-acceso" : "revocado";
  }
  return out;
}

/**
 * El juez pide acceso con su e-mail. No dice nada de vuelta: quien llama
 * responde siempre lo mismo, esté o no el e-mail en el censo, para que la
 * pantalla no sirva para averiguar quién es juez.
 *
 * Solo actúa si el e-mail es exactamente el de UNA ficha. Una ficha con el
 * acceso retirado no se reactiva así: eso lo decide un delegado.
 */
export async function requestJudgeAccess(email: string, redirectTo: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return;

  let matches: Referee[];
  if (isSupabaseConfigured()) {
    const { data, error } = await createAdminClient()
      .from("referees")
      .select("*")
      .ilike("email", clean.replace(/[%_\\]/g, "\\$&"))
      .limit(2);
    if (error) throw new Error(`referees: ${error.message}`);
    matches = (data ?? []).map((row) => mapReferee(row as Record<string, unknown>));
  } else {
    matches = getStore().referees.filter((r) => r.email?.trim().toLowerCase() === clean);
  }
  // Dos fichas con el mismo e-mail: no se sabe de quién es, así que nada.
  if (matches.length !== 1) return;
  const referee = matches[0]!;

  const status = (await getJudgeAccessStatuses([referee]))[referee.id];
  if (status === "revocado") return;
  await inviteJudges([referee], redirectTo);
}
