"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const REFRESH_MS = 60_000;

function relativeLabel(seconds: number): string {
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds}s`;
  const min = Math.floor(seconds / 60);
  return `hace ${min} min`;
}

/**
 * Barra de control en vivo — el panel se retroalimenta solo.
 * Refresca el árbol de servidor cada 60 s vía router.refresh().
 */
export function DashboardLive({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [auto, setAuto] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(Date.now());

  useEffect(() => {
    baseRef.current = Date.now();
    setElapsed(0);
  }, [generatedAt]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - baseRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [auto, refresh]);

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
        <span className="text-[11.5px] font-medium text-foreground/70">
          {isPending ? "Actualizando…" : auto ? "En vivo" : "Pausado"}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          · {relativeLabel(elapsed)}
        </span>
      </div>

      {/* Controls — minimal, icon-first */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          aria-pressed={auto}
          aria-label={auto ? "Pausar actualización automática" : "Reanudar actualización automática"}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
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
