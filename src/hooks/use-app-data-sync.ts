"use client";

import { useEffect } from "react";
import { APP_DATA_SYNC_EVENT } from "@/lib/realtime/sync-events";

/** Ejecuta `onSync` cuando la app detecta cambios en Supabase (realtime o poll). */
export function useAppDataSync(onSync: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = () => onSync();
    window.addEventListener(APP_DATA_SYNC_EVENT, handler);
    return () => window.removeEventListener(APP_DATA_SYNC_EVENT, handler);
  }, [enabled, onSync]);
}
