"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LevelBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { Referee, RefereeLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, X } from "lucide-react";

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];

function higherLevels(current: RefereeLevel): RefereeLevel[] {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx >= 0 ? LEVEL_ORDER.slice(idx + 1) : [];
}

interface FormState {
  refereeId: string;
  toLevel: RefereeLevel | "";
  motivo: string;
}

function buildInitialForm(eligible: Referee[]): FormState {
  const first = eligible[0];
  const levels = first ? higherLevels(first.nivel) : [];
  return {
    refereeId: first?.id ?? "",
    toLevel: (levels[0] ?? "") as RefereeLevel | "",
    motivo: "",
  };
}

export function NewPromotionDialog({
  referees,
}: {
  referees: Referee[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  const eligible = referees.filter(
    (r) => r.estado === "Activo" && higherLevels(r.nivel).length > 0,
  );

  const [form, setForm] = useState<FormState>(() => buildInitialForm(eligible));

  const selectedRef = eligible.find((r) => r.id === form.refereeId);
  const availableLevels = selectedRef ? higherLevels(selectedRef.nivel) : [];

  // Reset form and error each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const freshEligible = referees.filter(
      (r) => r.estado === "Activo" && higherLevels(r.nivel).length > 0,
    );
    const first = freshEligible[0];
    const levels = first ? higherLevels(first.nivel) : [];
    setForm({
      refereeId: first?.id ?? "",
      toLevel: (levels[0] ?? "") as RefereeLevel | "",
      motivo: "",
    });
    setError(null);
  }, [open, referees]);

  // Escape key + initial focus
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const onRefereeChange = (id: string) => {
    const ref = eligible.find((r) => r.id === id);
    const levels = ref ? higherLevels(ref.nivel) : [];
    setForm((f) => ({
      ...f,
      refereeId: id,
      toLevel: levels[0] ?? "",
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.refereeId || !form.toLevel) return;
    setError(null);
    startTransition(async () => {
      try {
        await api.createPromotion({
          refereeId: form.refereeId,
          toLevel: form.toLevel as RefereeLevel,
          motivo: form.motivo || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar");
      }
    });
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} disabled={eligible.length === 0}>
        <TrendingUp className="mr-1.5 h-4 w-4" />
        Nueva solicitud
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-promo-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="new-promo-title" className="text-base font-semibold text-foreground">
            Solicitar ascenso de nivel
          </h2>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Juez selector */}
          <div>
            <label className="friendly-label mb-1 block">Juez</label>
            <select
              className={`${selectFieldClass} w-full`}
              value={form.refereeId}
              onChange={(e) => onRefereeChange(e.target.value)}
              required
            >
              {eligible.length === 0 && <option value="">Sin jueces elegibles</option>}
              {eligible.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} — {r.nivel}
                </option>
              ))}
            </select>
          </div>

          {/* Level transition visual */}
          {selectedRef && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-muted">
                Transición de nivel
              </p>
              <div className="flex items-center gap-2">
                <LevelBadge level={selectedRef.nivel} />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle-muted" aria-hidden="true" />
                {form.toLevel ? (
                  <LevelBadge level={form.toLevel as RefereeLevel} />
                ) : (
                  <span className="text-xs text-muted-foreground">Selecciona destino</span>
                )}
              </div>
            </div>
          )}

          {/* Nivel destino — visual pill picker (destino siempre > origen) */}
          <div>
            <label className="friendly-label mb-2 block">Nivel destino</label>
            {availableLevels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay niveles superiores disponibles para este juez.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableLevels.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, toLevel: l }))}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all focus-ring",
                      form.toLevel === l
                        ? "border-primary bg-primary text-primary-foreground shadow-glow-primary"
                        : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-hover",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Motivo — textarea for longer descriptions */}
          <div>
            <label className="friendly-label mb-1 block">
              Motivo{" "}
              <span className="font-normal text-subtle-muted">(opcional)</span>
            </label>
            <textarea
              placeholder="Ej. 6 competiciones completadas como central en AEP-2, nivel técnico demostrado…"
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              className={textareaFieldClass}
              rows={3}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !form.refereeId || !form.toLevel}>
              {pending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
