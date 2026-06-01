import { createAdminClient } from "@/lib/supabase/admin";

export type DeviceEnvironment = "sandbox" | "production";

export interface DeviceRegistration {
  userId: string;
  apnsToken: string;
  environment: DeviceEnvironment;
  deviceModel?: string;
  appVersion?: string;
  locale?: string;
}

/** Registra o actualiza el token APNs de un dispositivo del usuario. */
export async function registerDeviceToken(reg: DeviceRegistration): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("device_tokens").upsert(
    {
      user_id: reg.userId,
      apns_token: reg.apnsToken,
      environment: reg.environment,
      device_model: reg.deviceModel ?? null,
      app_version: reg.appVersion ?? null,
      locale: reg.locale ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,apns_token" },
  );
  if (error) throw new Error(error.message);
}

/** Elimina el token APNs (logout o token invalidado por APNs). */
export async function removeDeviceToken(userId: string, apnsToken: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("device_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("apns_token", apnsToken);
  if (error) throw new Error(error.message);
}

/** Tokens APNs activos de un conjunto de usuarios (para emitir push). */
export async function deviceTokensForUsers(userIds: string[]): Promise<
  Array<{ apnsToken: string; environment: DeviceEnvironment }>
> {
  if (userIds.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("device_tokens")
    .select("apns_token, environment")
    .in("user_id", userIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    apnsToken: row.apns_token as string,
    environment: row.environment as DeviceEnvironment,
  }));
}
