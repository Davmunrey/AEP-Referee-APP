/** Evento DOM para avisar a pantallas con estado cliente que deben refetch. */
export const APP_DATA_SYNC_EVENT = "aep:data-sync";

export type AppDataSyncSource = "realtime" | "poll" | "manual";

export function dispatchAppDataSync(source: AppDataSyncSource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_DATA_SYNC_EVENT, { detail: { source } }));
}
