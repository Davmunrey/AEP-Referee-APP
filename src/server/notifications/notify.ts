import { createAdminClient } from "@/lib/supabase/admin";
import { deviceTokensForUsers } from "@/server/notifications/device-tokens";
import {
  isApnsConfigured,
  sendApnsPush,
  type ApnsNotification,
} from "@/server/notifications/apns";

/** IDs de usuarios del comité nacional (pueden aprobar tarimas), activos. */
export async function approverUserIds(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "delegado_jueces"])
    .eq("activo", true);
  if (error || !data) return [];
  return data.map((row) => row.id as string);
}

/**
 * Envía una push a un conjunto de usuarios. Best-effort: nunca lanza ni
 * bloquea la respuesta de la API; si APNs no está configurado, es un no-op.
 */
export async function notifyUsers(
  userIds: string[],
  notification: ApnsNotification,
): Promise<void> {
  if (!isApnsConfigured() || userIds.length === 0) return;
  try {
    const targets = await deviceTokensForUsers(userIds);
    if (targets.length === 0) return;
    const results = await sendApnsPush(targets, notification);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error(
        "[notifyUsers] push fallidas:",
        failed.map((f) => `${f.status ?? "?"}:${f.reason ?? ""}`).join(", "),
      );
    }
  } catch (err) {
    console.error("[notifyUsers]", err instanceof Error ? err.message : err);
  }
}

/** Avisa al comité nacional de que una tarima espera aprobación. */
export async function notifyRosterSubmitted(
  competitionName: string,
  competitionId: string,
): Promise<void> {
  if (!isApnsConfigured()) return;
  await notifyUsers(await approverUserIds(), {
    title: "Tarima pendiente de aprobación",
    body: `${competitionName} tiene una propuesta de tarima esperando revisión.`,
    type: "approval_pending",
    data: { competitionId },
    threadId: "approvals",
  });
}
