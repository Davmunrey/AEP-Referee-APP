"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { dispatchAppDataSync } from "@/lib/realtime/sync-events";

const POLL_MS = 12_000;
const DEBOUNCE_MS = 400;

/**
 * Mantiene la UI sincronizada con Supabase:
 * - Realtime postgres_changes en `app_sync_state` (migration 029)
 * - Poll de respaldo cada 12 s por si Realtime se desconecta
 * - Refresco al volver a la pestaña
 */
export function AppRealtimeSync() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const versionRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  const applySync = useCallback(
    (source: "realtime" | "poll" | "manual") => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(() => {
          router.refresh();
          dispatchAppDataSync(source);
          pendingRef.current = false;
        });
      }, DEBOUNCE_MS);
    },
    [router],
  );

  const pollVersion = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_sync_state")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return;
      const next = Number(data.version);
      if (versionRef.current === null) {
        versionRef.current = next;
        return;
      }
      if (next !== versionRef.current) {
        versionRef.current = next;
        applySync("poll");
      }
    } catch {
      // Sin conexión: el siguiente poll lo reintentará.
    }
  }, [applySync]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const id = setInterval(() => applySync("poll"), POLL_MS);
      return () => clearInterval(id);
    }

    const supabase = createClient();
    let cancelled = false;

    void pollVersion();

    const channel = supabase
      .channel("aep-app-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_sync_state" },
        (payload) => {
          const next = Number((payload.new as { version?: number })?.version);
          if (!Number.isFinite(next)) return;
          if (versionRef.current === null) {
            versionRef.current = next;
            return;
          }
          if (next !== versionRef.current) {
            versionRef.current = next;
            applySync("realtime");
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void pollVersion();
        }
      });

    const pollId = setInterval(() => {
      if (!cancelled) void pollVersion();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void pollVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [applySync, pollVersion]);

  // Indicador accesible para lectores de pantalla cuando hay refresh en curso.
  return (
    <span className="sr-only" aria-live="polite" aria-busy={isPending}>
      {isPending ? "Sincronizando datos…" : ""}
    </span>
  );
}
