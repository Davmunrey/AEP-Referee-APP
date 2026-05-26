"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { RefereeUnavailabilityPeriod } from "@/lib/types";

interface RefereeAvailabilityPanelProps {
  refereeId: string;
  initialPeriods: RefereeUnavailabilityPeriod[];
  canEdit: boolean;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatPeriod(start: string, end: string) {
  if (start === end) return start;
  return `${start} → ${end}`;
}

export function RefereeAvailabilityPanel({
  refereeId,
  initialPeriods,
  canEdit,
}: RefereeAvailabilityPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(todayIso());
  const [fechaFin, setFechaFin] = useState(todayIso());
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (fechaFin < fechaInicio) {
      setError("La fecha de fin debe ser igual o posterior a la de inicio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await api.addRefereeUnavailability(refereeId, { fechaInicio, fechaFin, notas: notas || undefined });
        setOpen(false);
        setFechaInicio(todayIso());
        setFechaFin(todayIso());
        setNotas("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar el período.");
      }
    });
  };

  const remove = (periodId: string) => {
    startTransition(async () => {
      try {
        await api.removeRefereeUnavailability(refereeId, periodId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar el período.");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Períodos de no disponibilidad</CardTitle>
        </div>
        {canEdit && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Añadir período
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {open && canEdit && (
          <form onSubmit={add} className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs text-subtle-muted">
              El juez aparecerá como no disponible en el cuadrante para campeonatos que caigan
              dentro del rango indicado.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Inicio</label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Fin</label>
                <Input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Notas (opcional)</label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. vacaciones, lesión…"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {initialPeriods.length === 0 && !open && (
          <p className="text-sm text-subtle-muted">Sin períodos registrados.</p>
        )}

        {initialPeriods.length > 0 && (
          <ul className="space-y-2">
            {initialPeriods.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border-muted px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-mono font-medium text-foreground">
                    {formatPeriod(p.fechaInicio, p.fechaFin)}
                  </p>
                  {p.notas && (
                    <p className="mt-0.5 truncate text-subtle-muted">{p.notas}</p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(p.id)}
                    className="shrink-0 rounded p-1 text-subtle-muted transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label="Eliminar período"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
