"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { APP_DATA_SYNC_EVENT, setAutoSyncPaused } from "@/lib/realtime/sync-events";

function relativeLabel(seconds: number): string {
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds}s`;
  const min = Math.floor(seconds / 60);
  return `hace ${min} min`;
}

/**
 * Barra de control en vivo — refleja la sincronización global (AppRealtimeSync).
 */
export function DashboardLive({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [auto, setAuto] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(Date.now());

  const markSynced = useCallback(() => {
    baseRef.current = Date.now();
    setElapsed(0);
  }, []);

  useEffect(() => {
    markSynced();
  }, [generatedAt, markSynced]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // El botón solo cambiaba su propia etiqueta: la sincronización global seguía
  // refrescando con cada cambio en tiempo real y con el poll de 30 s, así que
  // la barra decía «Pausado» mientras los datos cambiaban debajo. Ahora la
  // pausa es real, y al reanudar se refresca de inmediato: mientras estuvo
  // pausada la versión siguió anotándose, de modo que ningún cambio posterior
  // dispararía por sí solo el refresco que faltaba.
  const toggleAuto = useCallback(() => {
    setAuto((prev) => {
      const next = !prev;
      setAutoSyncPaused(!next);
      if (next) refresh();
      return next;
    });
  }, [refresh]);

  // Si la pantalla se desmonta pausada, la pausa no puede quedarse activa para
  // el resto de la aplicación.
  useEffect(() => () => setAutoSyncPaused(false), []);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - baseRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const onSync = () => markSynced();
    window.addEventListener(APP_DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(APP_DATA_SYNC_EVENT, onSync);
  }, [auto, markSynced]);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-muted bg-surface px-3.5 py-2"
      aria-live="polite"
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {auto && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          )}
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              auto ? "bg-success" : "bg-muted-foreground/40",
            )}
          />
        </span>
        <span className="text-xs font-medium text-foreground/70">
          {isPending ? "Actualizando…" : auto ? "En vivo" : "Pausado"}
        </span>
        {/* tabular-nums: el contador se reescribe cada segundo; con cifras de
            ancho variable la línea entera daría un salto por tick. */}
        <span className="text-[11px] tabular-nums text-muted-foreground">
          · {relativeLabel(elapsed)}
        </span>
      </div>

      {/* Controls — minimal, icon-first */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleAuto}
          aria-pressed={auto}
          aria-label={auto ? "Pausar actualización automática" : "Reanudar actualización automática"}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-ring"
        >
          {auto ? (
            <Pause className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Play className="h-3 w-3" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{auto ? "Pausar" : "Reanudar"}</span>
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          aria-label="Actualizar panel ahora"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-ring disabled:opacity-40"
        >
          <RefreshCw
            className={cn("h-3 w-3", isPending && "animate-spin")}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>
    </div>
  );
}
