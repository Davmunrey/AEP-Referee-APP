"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Referee, RefereeLevel, Zone } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { TrendingUp, X } from "lucide-react";

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];

function higherLevels(current: RefereeLevel): RefereeLevel[] {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx >= 0 ? LEVEL_ORDER.slice(idx + 1) : [];
}

export function NewPromotionDialog({
  referees,
  zones,
  userZona,
}: {
  referees: Referee[];
  zones: Zone[];
  userZona?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const eligible = referees.filter(
    (r) => r.estado === "Activo" && higherLevels(r.nivel).length > 0,
  );

  const [form, setForm] = useState({
    refereeId: eligible[0]?.id ?? "",
    toLevel: "" as RefereeLevel | "",
    motivo: "",
    zona: userZona ?? eligible[0]?.zona ?? zones[0]?.code ?? "",
  });

  const selectedRef = eligible.find((r) => r.id === form.refereeId);
  const availableLevels = selectedRef ? higherLevels(selectedRef.nivel) : [];

  const onRefereeChange = (id: string) => {
    const ref = eligible.find((r) => r.id === id);
    const levels = ref ? higherLevels(ref.nivel) : [];
    setForm((f) => ({
      ...f,
      refereeId: id,
      toLevel: levels[0] ?? "",
      zona: userZona ?? ref?.zona ?? f.zona,
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
          zona: form.zona,
          motivo: form.motivo || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar");
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} disabled={eligible.length === 0}>
        <TrendingUp className="mr-1.5 h-4 w-4" />
        Nueva solicitud
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-promo-title" className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-promo-title" className="text-lg font-semibold">Solicitar ascenso de nivel</h2>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="friendly-label mb-1 block">Árbitro</label>
            <select
              className={`${selectFieldClass} w-full`}
              value={form.refereeId}
              onChange={(e) => onRefereeChange(e.target.value)}
              required
            >
              {eligible.length === 0 && (
                <option value="">Sin árbitros elegibles</option>
              )}
              {eligible.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.nivel})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="friendly-label mb-1 block">Nivel destino</label>
            <select
              className={`${selectFieldClass} w-full`}
              value={form.toLevel}
              onChange={(e) => setForm((f) => ({ ...f, toLevel: e.target.value as RefereeLevel }))}
              required
            >
              {availableLevels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {!userZona && (
            <div>
              <label className="friendly-label mb-1 block">Zona</label>
              <select
                className={`${selectFieldClass} w-full`}
                value={form.zona}
                onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
              >
                {zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="friendly-label mb-1 block">Motivo (opcional)</label>
            <Input
              placeholder="Ej. 6 eventos completados como central en AEP-2"
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || !form.refereeId || !form.toLevel}
            >
              {pending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
