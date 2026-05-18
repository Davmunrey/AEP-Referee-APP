"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, TrendingUp, X } from "lucide-react";
import { LevelBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { RefereeLevel } from "@/lib/types";

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];
const MOTIVO_MAX = 300;

interface RefereePromotionButtonProps {
  refereeId: string;
  currentLevel: RefereeLevel;
}

export function RefereePromotionButton({ refereeId, currentLevel }: RefereePromotionButtonProps) {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  const higherLevels = idx >= 0 ? LEVEL_ORDER.slice(idx + 1) : [];
  const [open, setOpen] = useState(false);
  const [toLevel, setToLevel] = useState<RefereeLevel>(higherLevels[0] ?? "Nacional");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (higherLevels.length === 0) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await api.createPromotion({ refereeId, toLevel, motivo: motivo || undefined });
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-dialog-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h2 id="promotion-dialog-title" className="text-base font-semibold">
              Solicitar ascenso
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          {/* Promotion path */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <LevelBadge level={currentLevel} />
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle-muted" />
            <LevelBadge level={toLevel} />
          </div>

          {/* Destination level selector */}
          <div>
            <label className="friendly-label mb-1 block">Nivel destino</label>
            <select
              className={`${selectFieldClass} w-full`}
              value={toLevel}
              onChange={(e) => setToLevel(e.target.value as RefereeLevel)}
              required
            >
              {higherLevels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Motivo with character counter */}
          <div>
            <label className="friendly-label mb-1 block">Motivo (opcional)</label>
            <div className="relative">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value.slice(0, MOTIVO_MAX))}
                placeholder="Ej. 6 competiciones como central en AEP-2, examen teórico aprobado…"
                className={textareaFieldClass}
                rows={3}
                maxLength={MOTIVO_MAX}
              />
              <span
                className={`absolute bottom-2 right-3 text-[10px] tabular-nums ${
                  motivo.length >= MOTIVO_MAX * 0.9
                    ? "text-warning"
                    : "text-subtle-muted"
                }`}
              >
                {motivo.length}/{MOTIVO_MAX}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
