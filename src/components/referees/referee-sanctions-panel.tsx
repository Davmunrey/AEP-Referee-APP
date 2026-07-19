"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Mail, ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import {
  formatSanctionPeriod,
  isSanctionActive,
  SANCTION_DURATION_PRESETS,
  sanctionStatusLabel,
  todayIso,
} from "@/lib/sanctions";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type {
  RefereeSanction,
  SanctionDurationPreset,
  Zone,
} from "@/lib/types";

interface RefereeSanctionsPanelProps {
  refereeId: string;
  zonaName: string;
  sanctions: RefereeSanction[];
  activeSanction?: RefereeSanction;
  canManage: boolean;
  zones: Zone[];
}

export function RefereeSanctionsPanel({
  refereeId,
  zonaName,
  sanctions,
  activeSanction,
  canManage,
}: RefereeSanctionsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fechaInicio, setFechaInicio] = useState(todayIso());
  const [duration, setDuration] = useState<SanctionDurationPreset>("30d");
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastCreated, setLastCreated] = useState<RefereeSanction | null>(null);

  const impose = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await api.createRefereeSanction(refereeId, {
          motivo,
          fechaInicio,
          duration,
          fechaFin: duration === "custom" ? fechaFin : undefined,
          notas: notas || undefined,
        });
        setLastCreated(created);
        setOpen(false);
        setMotivo("");
        setNotas("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al imponer sanción");
      }
    });
  };

  const revoke = (sanctionId: string) => {
    const motivoRev = window.prompt("Motivo de revocación (opcional):") ?? "";
    startTransition(async () => {
      try {
        await api.revokeSanction(sanctionId, motivoRev || undefined);
        setLastCreated(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo revocar");
      }
    });
  };

  const markNotified = (sanctionId: string) => {
    startTransition(async () => {
      await api.markSanctionNotified(sanctionId);
      router.refresh();
    });
  };

  const notifyTarget = lastCreated ?? activeSanction;
  const mailto = notifyTarget?.delegateNotify.mailtoUrl;
  const delegates = notifyTarget?.delegateNotify.delegates ?? [];

  return (
    <Card className="border-warning-border/40">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-4 w-4 text-warning" />
          <CardTitle className="text-sm font-semibold">Sanciones disciplinarias</CardTitle>
        </div>
        {canManage && !activeSanction && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            Imponer sanción
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {activeSanction && (
          <div
            className="rounded-lg border border-warning-border bg-warning-subtle px-4 py-3 text-sm"
            role="status"
          >
            <p className="font-semibold text-warning">Sanción activa</p>
            <p className="mt-1 text-foreground-secondary">
              {formatSanctionPeriod(activeSanction.fechaInicio, activeSanction.fechaFin)}
            </p>
            <p className="mt-2 text-xs text-foreground-secondary">{activeSanction.motivo}</p>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                {mailto && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={mailto} onClick={() => markNotified(activeSanction.id)}>
                      <Mail className="mr-1.5 h-3.5 w-3.5" />
                      Avisar delegado zona
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => revoke(activeSanction.id)}
                >
                  Revocar antes de tiempo
                </Button>
              </div>
            )}
            {delegates.length === 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                No hay delegado de zona activo en {zonaName}. Añade uno en Administración.
              </p>
            )}
            {activeSanction.delegateNotify.notifiedAt && (
              <p className="mt-2 flex items-center gap-1 text-xs text-success">
                <Bell className="h-3.5 w-3.5" />
                Delegado notificado{" "}
                {new Date(activeSanction.delegateNotify.notifiedAt).toLocaleString("es-ES")}
              </p>
            )}
          </div>
        )}

        {open && canManage && (
          <form onSubmit={impose} className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs text-subtle-muted">
              Se notificará al delegado de {zonaName}. El juez queda fuera de tarima hasta la fecha
              de fin.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">Motivo</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                required
                minLength={10}
                className={textareaFieldClass}
                placeholder="Describe la incidencia o resolución…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">Inicio</label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">Duración</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as SanctionDurationPreset)}
                  className={selectFieldClass}
                >
                  {SANCTION_DURATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {duration === "custom" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">Fin</label>
                <Input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">Notas internas (opcional)</label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Guardando…" : "Confirmar sanción"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {sanctions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle-muted">
              Historial
            </p>
            <ul className="space-y-2">
              {sanctions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-border-muted px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {sanctionStatusLabel(s.status)}
                      {isSanctionActive(s) ? " · vigente" : ""}
                    </span>
                    <span className="font-mono text-subtle-muted">
                      {formatSanctionPeriod(s.fechaInicio, s.fechaFin)}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground-secondary">{s.motivo}</p>
                  <p className="mt-1 text-subtle-muted">
                    Por {s.impuestaPorNombre}
                    {s.revocadaPorNombre ? ` · Revocada por ${s.revocadaPorNombre}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
