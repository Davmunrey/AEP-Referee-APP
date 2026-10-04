/**
 * Cuentas de juez para el portal.
 *
 * La aplicación no envía correos. El acceso se da con un CÓDIGO:
 *
 *  · el delegado pulsa «Dar acceso» (en la ficha o en bloque desde el
 *    directorio): se crea la cuenta —con el e-mail de la ficha, sin enviar
 *    nada— y se genera un código que solo se ve en ese momento;
 *  · se lo pasa al juez por su cuenta (WhatsApp, en mano);
 *  · el juez entra en «Soy juez › Tengo un código» con su e-mail del censo y
 *    el código, y crea su contraseña. A partir de ahí entra como cualquiera.
 *
 * Si la olvida, el delegado le da un código nuevo desde la ficha. Si el juez
 * no tiene código, puede pedirlo desde la pantalla de acceso: llega un aviso
 * a la campana de su delegado de zona (nunca un correo).
 *
 * Nadie que no esté en el censo puede tener cuenta de juez, y el e-mail es
 * siempre el de la ficha. Retirar el acceso desactiva el perfil (y anula el
 * código pendiente) y conserva el enlace con la ficha; dar acceso de nuevo
 * reactiva la misma cuenta. Como `getSession` relee el perfil en cada
 * petición, el acceso se corta en el acto.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveZoneCode } from "@/lib/aep-zones";
import { getStore } from "@/server/store";
import { mapReferee } from "@/server/db/mappers";
import { dataService } from "@/server/services";
import { delegadosDeZona, gestionNacional } from "@/server/destinatarios";
import { memoryJudgeActive } from "@/server/judge-memory";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_MAX_ATTEMPTS,
  ACCESS_CODE_TTL_DAYS,
  JUDGE_PASSWORD_MIN,
  normalizeAccessCode,
  type JudgeAccessStatus,
  type JudgeCodeOutcome,
  type JudgeCodeResult,
} from "@/lib/judge-access";
import type { Referee } from "@/lib/types";

export type { JudgeAccessStatus, JudgeCodeOutcome, JudgeCodeResult } from "@/lib/judge-access";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initialsOf(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : nombre.slice(0, 2)).toUpperCase();
}

// ── Códigos ────────────────────────────────────────────────────────────────

/** 8 símbolos del alfabeto sin ambigüedades, con azar criptográfico. */
export function generateAccessCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return out;
}

/** Resumen ligado a la ficha: el mismo código no vale para otro juez. */
function hashCode(refereeId: string, code: string): string {
  return createHash("sha256").update(`${refereeId}:${normalizeAccessCode(code)}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

interface StoredCode {
  refereeId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
}

// Memoria (dev sin Supabase): ni auth ni tabla; se simula para poder probar
// el directorio, la ficha y el portal en local.
const memoryActive = memoryJudgeActive;
const memoryCodes = new Map<string, StoredCode>();

export { isMemoryJudgeAccountActive } from "@/server/judge-memory";

async function saveCode(row: StoredCode, createdBy?: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryCodes.set(row.refereeId, row);
    return;
  }
  const { error } = await createAdminClient().from("judge_access_codes").upsert({
    referee_id: row.refereeId,
    code_hash: row.codeHash,
    expires_at: row.expiresAt,
    attempts: 0,
    created_by: createdBy ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`judge_access_codes: ${error.message}`);
}

async function readCodes(refereeIds: string[]): Promise<Map<string, StoredCode>> {
  const out = new Map<string, StoredCode>();
  if (refereeIds.length === 0) return out;
  if (!isSupabaseConfigured()) {
    for (const id of refereeIds) {
      const row = memoryCodes.get(id);
      if (row) out.set(id, row);
    }
    return out;
  }
  for (let i = 0; i < refereeIds.length; i += 200) {
    const { data, error } = await createAdminClient()
      .from("judge_access_codes")
      .select("referee_id, code_hash, expires_at, attempts")
      .in("referee_id", refereeIds.slice(i, i + 200));
    if (error) throw new Error(`judge_access_codes: ${error.message}`);
    for (const r of data ?? []) {
      out.set(String(r.referee_id), {
        refereeId: String(r.referee_id),
        codeHash: String(r.code_hash),
        expiresAt: String(r.expires_at),
        attempts: Number(r.attempts ?? 0),
      });
    }
  }
  return out;
}

async function deleteCode(refereeId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryCodes.delete(refereeId);
    return;
  }
  const { error } = await createAdminClient().from("judge_access_codes").delete().eq("referee_id", refereeId);
  if (error) throw new Error(`judge_access_codes: ${error.message}`);
}

async function countFailedAttempt(row: StoredCode): Promise<void> {
  const attempts = row.attempts + 1;
  if (attempts >= ACCESS_CODE_MAX_ATTEMPTS) {
    await deleteCode(row.refereeId);
    return;
  }
  if (!isSupabaseConfigured()) {
    memoryCodes.set(row.refereeId, { ...row, attempts });
    return;
  }
  const { error } = await createAdminClient()
    .from("judge_access_codes")
    .update({ attempts })
    .eq("referee_id", row.refereeId);
  if (error) throw new Error(`judge_access_codes: ${error.message}`);
}

// ── Cuenta ─────────────────────────────────────────────────────────────────

/**
 * La cuenta de acceso entra con el e-mail del CENSO. Si el delegado lo cambia
 * en la ficha, la cuenta se queda con el viejo: quien conociera la contraseña
 * seguiría entrando con un e-mail que ya no es el del juez. Aquí se iguala.
 */
export async function syncJudgeLoginEmail(referee: Pick<Referee, "userId" | "email">): Promise<void> {
  if (!isSupabaseConfigured() || !referee.userId) return;
  const email = referee.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(referee.userId);
  if (error || !data.user) throw new Error(`auth.getUserById: ${error?.message ?? "sin usuario"}`);
  if ((data.user.email ?? "").toLowerCase() === email) return;
  const { error: upErr } = await admin.auth.admin.updateUserById(referee.userId, { email, email_confirm: true });
  if (upErr) throw new Error(`auth.updateUserById: ${upErr.message}`);
  const { error: pErr } = await admin.from("profiles").update({ email }).eq("id", referee.userId).eq("role", "juez");
  if (pErr) throw new Error(`profiles: ${pErr.message}`);
}

type EnsureResult = { outcome: "ok" } | { outcome: Exclude<JudgeCodeOutcome, "codigo"> };

function memoryEnsure(referee: Referee): EnsureResult {
  if (!referee.email || !EMAIL_RE.test(referee.email)) return { outcome: "sin-email" };
  const row = getStore().referees.find((r) => r.id === referee.id);
  if (!row) return { outcome: "no-encontrado" };
  if (!row.userId) row.userId = `mem-juez-${row.id}`;
  memoryActive.set(row.userId, true);
  return { outcome: "ok" };
}

/**
 * Deja la ficha con una cuenta de juez activa: la reactiva si estaba retirada
 * o la crea si no la tenía. Sin enviar nada: la cuenta nace con una
 * contraseña aleatoria que nadie conoce, y la de verdad la pone el juez con
 * el código.
 */
async function supabaseEnsure(referee: Referee): Promise<EnsureResult> {
  const email = referee.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { outcome: "sin-email" };
  const admin = createAdminClient();

  if (referee.userId) {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, activo, role")
      .eq("id", referee.userId)
      .maybeSingle();
    if (error) throw new Error(`profiles: ${error.message}`);
    if (profile && profile.role === "juez") {
      await syncJudgeLoginEmail({ userId: referee.userId, email });
      if (!profile.activo) {
        const { error: upErr } = await admin.from("profiles").update({ activo: true }).eq("id", profile.id);
        if (upErr) throw new Error(`profiles: ${upErr.message}`);
      }
      return { outcome: "ok" };
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
  if ((taken ?? []).length > 0) return { outcome: "email-en-uso" };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
    user_metadata: { full_name: referee.nombre },
  });
  if (createErr || !created.user) {
    const code = (createErr as { code?: string } | null)?.code ?? "";
    if (code === "email_exists" || /already (been )?registered|already exists/i.test(createErr?.message ?? "")) {
      return { outcome: "email-en-uso" };
    }
    console.error("[judge-accounts.createUser]", createErr?.message);
    return { outcome: "error" };
  }
  const userId = created.user.id;

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

  // Enlace condicional: si otro delegado dio acceso a la vez al mismo juez,
  // gana el primero y esta cuenta sobrante se borra (su código también vale:
  // el código va ligado a la ficha, no a la cuenta).
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
  }
  return { outcome: "ok" };
}

/**
 * Da acceso a las fichas indicadas: cuenta activa + código nuevo para cada
 * una. Un código nuevo sustituye al anterior (también sirve para quien olvidó
 * su contraseña). El código solo vuelve en esta respuesta.
 */
export async function issueAccessCodes(referees: Referee[], createdBy?: string): Promise<JudgeCodeResult[]> {
  const results: JudgeCodeResult[] = [];
  const expiresAt = new Date(Date.now() + ACCESS_CODE_TTL_DAYS * 86_400_000).toISOString();
  for (const referee of referees) {
    const base = { refereeId: referee.id, nombre: referee.nombre, email: referee.email };
    try {
      const ensured = isSupabaseConfigured() ? await supabaseEnsure(referee) : memoryEnsure(referee);
      if (ensured.outcome !== "ok") {
        results.push({ ...base, outcome: ensured.outcome });
        continue;
      }
      const code = generateAccessCode();
      await saveCode({ refereeId: referee.id, codeHash: hashCode(referee.id, code), expiresAt, attempts: 0 }, createdBy);
      results.push({ ...base, outcome: "codigo", code, expiresAt });
    } catch (err) {
      console.error("[judge-accounts.issueAccessCodes]", err);
      results.push({ ...base, outcome: "error" });
    }
  }
  return results;
}

/** Retira el acceso al portal. Devuelve `false` si el juez no tenía cuenta. */
export async function revokeJudgeAccess(referee: Referee): Promise<boolean> {
  if (!referee.userId) return false;
  await deleteCode(referee.id);
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

/**
 * Estado de acceso al portal de cada ficha y, si tiene un código sin usar,
 * cuándo caduca.
 */
export async function getJudgeAccessStatuses(
  referees: Referee[],
): Promise<{ statuses: Record<string, JudgeAccessStatus>; codeExpiry: Record<string, string> }> {
  const statuses: Record<string, JudgeAccessStatus> = {};
  const codeExpiry: Record<string, string> = {};
  for (const r of referees) statuses[r.id] = "sin-acceso";
  const linked = referees.filter((r) => r.userId);
  if (linked.length === 0) return { statuses, codeExpiry };

  const active = new Map<string, boolean>();
  if (!isSupabaseConfigured()) {
    for (const r of linked) active.set(r.userId!, memoryActive.get(r.userId!) !== false);
  } else {
    const ids = linked.map((r) => r.userId!);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await createAdminClient()
        .from("profiles")
        .select("id, activo, role")
        .in("id", ids.slice(i, i + 200));
      if (error) throw new Error(`profiles: ${error.message}`);
      for (const p of data ?? []) if (p.role === "juez") active.set(String(p.id), Boolean(p.activo));
    }
  }
  const codes = await readCodes(linked.map((r) => r.id));
  for (const r of linked) {
    const a = active.get(r.userId!);
    if (a === undefined) continue;
    if (!a) {
      statuses[r.id] = "revocado";
      continue;
    }
    const code = codes.get(r.id);
    if (code) {
      statuses[r.id] = "codigo-pendiente";
      codeExpiry[r.id] = code.expiresAt;
    } else {
      statuses[r.id] = "con-acceso";
    }
  }
  return { statuses, codeExpiry };
}

async function refereesByEmail(email: string): Promise<Referee[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createAdminClient()
      .from("referees")
      .select("*")
      .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
      .limit(2);
    if (error) throw new Error(`referees: ${error.message}`);
    return (data ?? []).map((row) => mapReferee(row as Record<string, unknown>));
  }
  return getStore().referees.filter((r) => r.email?.trim().toLowerCase() === email);
}

export type RedeemOutcome = "ok" | "invalido" | "contrasena-corta";

/**
 * El juez canjea su código: si el e-mail es el de UNA ficha con un código vivo
 * que coincide, su cuenta pasa a tener la contraseña que ha elegido y el
 * código se borra. Cualquier otro caso responde lo mismo («invalido»), para
 * que la pantalla no sirva para averiguar quién es juez ni qué códigos hay.
 */
export async function redeemAccessCode(email: string, code: string, password: string): Promise<RedeemOutcome> {
  if (password.length < JUDGE_PASSWORD_MIN) return "contrasena-corta";
  const clean = email.trim().toLowerCase();
  const normalized = normalizeAccessCode(code);
  if (!EMAIL_RE.test(clean) || normalized.length !== 8) return "invalido";

  const matches = await refereesByEmail(clean);
  // Dos fichas con el mismo e-mail: no se sabe de quién es, así que nada.
  if (matches.length !== 1 || !matches[0]!.userId) return "invalido";
  const referee = matches[0]!;
  const stored = (await readCodes([referee.id])).get(referee.id);
  if (!stored) return "invalido";
  if (new Date(stored.expiresAt).getTime() < Date.now()) {
    await deleteCode(referee.id);
    return "invalido";
  }
  if (!sameHash(stored.codeHash, hashCode(referee.id, normalized))) {
    await countFailedAttempt(stored);
    return "invalido";
  }

  if (isSupabaseConfigured()) {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, activo, role")
      .eq("id", referee.userId)
      .maybeSingle();
    if (error) throw new Error(`profiles: ${error.message}`);
    // Acceso retirado después de dar el código: el código ya no vale.
    if (!profile || profile.role !== "juez" || !profile.activo) {
      await deleteCode(referee.id);
      return "invalido";
    }
    await syncJudgeLoginEmail({ userId: referee.userId, email: clean });
    const { error: pwErr } = await admin.auth.admin.updateUserById(referee.userId!, { password });
    if (pwErr) throw new Error(`auth.updateUserById: ${pwErr.message}`);
  } else if (memoryActive.get(referee.userId!) === false) {
    await deleteCode(referee.id);
    return "invalido";
  }
  await deleteCode(referee.id);
  return "ok";
}

/**
 * El juez pide acceso desde la pantalla de acceso. No se le envía nada: llega
 * un aviso a la campana de su delegado de zona (o a la gestión nacional si la
 * zona no tiene delegado), que le dará un código. Quien llama responde
 * siempre lo mismo, esté o no el e-mail en el censo.
 *
 * Solo actúa si el e-mail es exactamente el de UNA ficha, y no para quien ya
 * tiene acceso (que entra con su contraseña) ni para una ficha con el acceso
 * retirado (eso lo decide un delegado, no el juez).
 */
export async function requestJudgeAccess(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return;
  const matches = await refereesByEmail(clean);
  if (matches.length !== 1) return;
  const referee = matches[0]!;
  const status = (await getJudgeAccessStatuses([referee])).statuses[referee.id];
  if (status === "revocado") return;

  const delegados = await delegadosDeZona(referee.zona);
  const destinatarios = delegados.length > 0 ? delegados : await gestionNacional();
  if (destinatarios.length === 0) return;
  const dia = new Date().toISOString().slice(0, 10);
  await dataService.insertNotificaciones(
    destinatarios.map((userId) => ({
      userId,
      tipo: "acceso-solicitado" as const,
      titulo: `${referee.nombre} pide acceso al portal`,
      cuerpo:
        status === "con-acceso"
          ? "Ya tiene cuenta: seguramente ha olvidado su contraseña. Dale un código nuevo desde su ficha."
          : "Dale un código desde su ficha y pásaselo por WhatsApp o en mano.",
      href: `/referees/${referee.id}`,
      // Una por juez y día: repetir la petición no llena la campana.
      clave: `acceso-solicitado:${referee.id}:${dia}`,
    })),
  );
}
