"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { selectFieldClass } from "@/lib/design-tokens";
import type { RefereeLevel } from "@/lib/types";

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];

interface RefereePromotionButtonProps {
  refereeId: string;
  currentLevel: RefereeLevel;
  zona: string;
}

export function RefereePromotionButton({ refereeId, currentLevel, zona }: RefereePromotionButtonProps) {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  const higherLevels = idx >= 0 ? LEVEL_ORDER.slice(idx + 1) : [];
  const [open, setOpen] = useState(false);
  const [toLevel, setToLevel] = useState<RefereeLevel>(higherLevels[0] ?? "Nacional");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (higherLevels.length === 0) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await api.createPromotion({ refereeId, toLevel, zona, motivo: motivo || undefined });
        setOpen(false);
        setMotivo("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar");
      }
    });
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TrendingUp className="mr-1.5 h-4 w-4" />
        Solicitar ascenso
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="promotion-dialog-title" className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="promotion-dialog-title" className="text-lg font-semibold">Solicitar ascenso</h2>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="friendly-label mb-1 block">Nivel destino</label>
            <select
              className={`${selectFieldClass} w-full`}
              value={toLevel}
              onChange={(e) => setToLevel(e.target.value as RefereeLevel)}
              required
            >
              {higherLevels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="friendly-label mb-1 block">Motivo (opcional)</label>
            <Input
              placeholder="Ej. 6 eventos como central en AEP-2"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
