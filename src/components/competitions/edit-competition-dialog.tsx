"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { FieldErrors, validateField } from "@/lib/competition-validation";
import type { Competition, Zone } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { zoneUiName } from "@/lib/aep-zones";
import { AEP_COMPETITION_TYPE_DESC } from "@/lib/aep-guide-2026";
import { cn } from "@/lib/utils";

const EVENT_TYPES = ["AEP-1", "AEP-2", "AEP-3"] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

interface EditCompetitionDialogProps {
  competition: Competition;
  zones: Zone[];
  open: boolean;
  onClose: () => void;
}

export function EditCompetitionDialog({
  competition,
  zones,
  open,
  onClose,
}: EditCompetitionDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(competition.nombre);
  const [tipo, setTipo] = useState(competition.tipo);
  const [fecha, setFecha] = useState(competition.fecha);
  const [fechaFin, setFechaFin] = useState(competition.fechaFin ?? "");
  const [sede, setSede] = useState(competition.sede);
  const [zona] = useState(competition.zona ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (!open) return null;

  const touch = (field: string) => setTouched((prev) => new Set(prev).add(field));

  const handleBlur = (field: string, value: string) => {
    touch(field);
    const err = validateField(field, value, fecha);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    const allFields: [string, string][] = [
      ["nombre", nombre],
      ["tipo", tipo],
      ["fecha", fecha],
      ["fechaFin", fechaFin],
      ["sede", sede],
    ];
    const newErrors: FieldErrors = {};
    for (const [field, value] of allFields) {
      const err = validateField(field, value, fecha);
      if (err) newErrors[field as keyof FieldErrors] = err;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(new Set(allFields.map(([f]) => f)));
      return;
    }

    startTransition(async () => {
      try {
        await api.updateCompetition(competition.id, { nombre, tipo, fecha, fechaFin, sede, zona });
        onClose();
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        if (msg.includes("403") || msg.toLowerCase().includes("permiso") || msg.toLowerCase().includes("forbidden")) {
          setGlobalError("Sin permiso para editar este campeonato");
        } else {
          setGlobalError(msg);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Editar campeonato</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-subtle-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Nombre */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
              Nombre del campeonato
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={(e) => handleBlur("nombre", e.target.value)}
              className={cn(touched.has("nombre") && errors.nombre && "border-destructive")}
            />
            <FieldError message={touched.has("nombre") ? errors.nombre : undefined} />
          </div>

          {/* Tipo + Zona */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Tipo AEP
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Competition["tipo"])}
                onBlur={(e) => handleBlur("tipo", e.target.value)}
                className={selectFieldClass}
                aria-label="Tipo AEP"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-subtle-muted">{AEP_COMPETITION_TYPE_DESC[tipo]}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Zona
              </label>
              <select
                value={zona}
                disabled
                className={cn(selectFieldClass, "opacity-60 cursor-not-allowed")}
                aria-label="Zona"
              >
                {zones.map((z) => (
                  <option key={z.code} value={z.code}>{zoneUiName(z.code)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Fecha inicio
              </label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                onBlur={(e) => handleBlur("fecha", e.target.value)}
                className={cn(touched.has("fecha") && errors.fecha && "border-destructive")}
              />
              <FieldError message={touched.has("fecha") ? errors.fecha : undefined} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Fecha fin
              </label>
              <Input
                type="date"
                value={fechaFin}
                min={fecha || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
                onBlur={(e) => handleBlur("fechaFin", e.target.value)}
                className={cn(touched.has("fechaFin") && errors.fechaFin && "border-destructive")}
              />
              <FieldError message={touched.has("fechaFin") ? errors.fechaFin : undefined} />
            </div>
          </div>

          {/* Sede */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
              Sede
            </label>
            <Input
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              onBlur={(e) => handleBlur("sede", e.target.value)}
              placeholder="Ciudad / pabellón"
              className={cn(touched.has("sede") && errors.sede && "border-destructive")}
            />
            <FieldError message={touched.has("sede") ? errors.sede : undefined} />
          </div>

          {/* Global error */}
          {globalError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive-border bg-destructive-muted px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {globalError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
