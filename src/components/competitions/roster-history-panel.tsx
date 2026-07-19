"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import type { RosterHistoryEntry } from "@/lib/types";
import { History, X } from "lucide-react";
import { cn } from "@/lib/utils";

function relativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (hr < 24) return `hace ${hr} h`;
  if (day < 7) return `hace ${day} d`;
  return new Date(isoString).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function actionDotClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("asign") || lower.includes("añad") || lower.includes("guardar"))
    return "bg-success ring-success/30";
  if (lower.includes("quitar") || lower.includes("elimin") || lower.includes("borra"))
    return "bg-warning ring-warning/30";
  if (lower.includes("envi") || lower.includes("aprobac") || lower.includes("submit"))
    return "bg-primary ring-primary/30";
  if (lower.includes("plantilla") || lower.includes("template") || lower.includes("import"))
    return "bg-info ring-info/30";
  if (lower.includes("marcador") || lower.includes("flag") || lower.includes("compartid"))
    return "bg-muted-foreground ring-border";
  return "bg-muted-foreground/50 ring-border";
}

function actionTextClass(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("asign") || lower.includes("añad") || lower.includes("guardar"))
    return "text-success";
  if (lower.includes("quitar") || lower.includes("elimin") || lower.includes("borra"))
    return "text-warning";
  if (lower.includes("envi") || lower.includes("aprobac") || lower.includes("submit"))
    return "text-primary";
  return "text-foreground";
}

export function RosterHistoryPanel({ competitionId }: { competitionId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<RosterHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (entries !== null) return;
    setLoading(true);
    try {
      const data = await api.getRosterHistory(competitionId);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => void toggle()}
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Historial
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border-muted px-4 py-3">
            <p className="text-xs font-semibold text-foreground">Historial de cambios</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Cerrar historial"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-xs text-subtle-muted">Cargando…</p>
            )}
            {!loading && entries?.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-subtle-muted">
                Sin cambios registrados.
              </p>
            )}
            {!loading && entries && entries.length > 0 && (
              <div className="relative py-2">
                {/* Timeline connector line */}
                <div className="absolute left-[27px] top-0 h-full w-px bg-border-muted" />
                {entries.map((e, idx) => (
                  <div key={e.id} className="relative flex gap-3 px-4 py-2.5">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-background ring-2",
                        actionDotClass(e.action),
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 pb-0.5">
                      <p
                        className={cn(
                          "text-[11.5px] font-medium leading-snug",
                          actionTextClass(e.action),
                        )}
                      >
                        {e.action}
                      </p>
                      {e.detail && (
                        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                          {e.detail}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-[10px] text-subtle-muted">
                        {e.actor}
                        {" · "}
                        <time
                          dateTime={e.at}
                          title={e.at}
                          className="tabular-nums"
                        >
                          {relativeTime(e.at)}
                        </time>
                      </p>
                    </div>
                    {/* Separator line between entries (except last) */}
                    {idx < entries.length - 1 && (
                      <div className="pointer-events-none absolute bottom-0 left-10 right-4 border-b border-border-muted/50" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
