"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import type { RosterHistoryEntry } from "@/lib/types";
import { History, X } from "lucide-react";

export function RosterHistoryPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<RosterHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (entries !== null) return;
    setLoading(true);
    try {
      const data = await api.getRosterHistory(eventId);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void toggle()}>
        <History className="h-3.5 w-3.5" />
        Historial
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border-muted px-4 py-3">
            <p className="text-xs font-semibold text-foreground">Historial de cambios</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border-muted">
            {loading && (
              <p className="px-4 py-6 text-center text-xs text-subtle-muted">Cargando…</p>
            )}
            {!loading && entries?.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-subtle-muted">Sin cambios registrados.</p>
            )}
            {!loading && entries?.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <p className="text-[11.5px] font-medium text-foreground">{e.action}</p>
                {e.detail && (
                  <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{e.detail}</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-subtle-muted">
                  {e.actor} · {e.at}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
