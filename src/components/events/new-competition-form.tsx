"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { EventType, Zone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { AlertCircle, CalendarRange, Loader2 } from "lucide-react";

const EVENT_TYPES: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];

const TYPE_DEFAULTS: Record<EventType, { sesiones: string; requeridos: string }> = {
  "AEP-1": { sesiones: "2", requeridos: "6" },
  "AEP-2": { sesiones: "3", requeridos: "9" },
  "AEP-3": { sesiones: "4", requeridos: "12" },
};

const TYPE_DESC: Record<EventType, string> = {
  "AEP-1": "Nivel básico — plantilla reducida",
  "AEP-2": "Estándar — configuración habitual",
  "AEP-3": "Nivel nacional — plantilla ampliada",
};

interface FieldErrors {
  nombre?: string;
  fecha?: string;
  fechaFin?: string;
  sede?: string;
  sesiones?: string;
  requeridos?: string;
}

interface NewCompetitionFormProps {
  zones: Zone[];
  defaultZona?: string;
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">
        {title}
      </span>
      <div className="flex-1 border-t border-border-muted" />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function validateField(field: string, value: string, fechaStart?: string): string | undefined {
  switch (field) {
    case "nombre":
      return value.trim() === "" ? "El nombre es obligatorio" : undefined;
    case "sede":
      return value.trim() === "" ? "La sede es obligatoria" : undefined;
    case "fecha":
      return value === "" ? "La fecha de inicio es obligatoria" : undefined;
    case "fechaFin":
      if (value && fechaStart && value < fechaStart)
        return "La fecha fin no puede ser anterior al inicio";
      return undefined;
    case "sesiones": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 1 || n > 6) return "Entre 1 y 6 sesiones";
      return undefined;
    }
    case "requeridos": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 1) return "Mínimo 1 plaza requerida";
      return undefined;
    }
  }
}

export function NewCompetitionForm({ zones, defaultZona }: NewCompetitionFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<EventType>("AEP-2");
  const [fecha, setFecha] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [sede, setSede] = useState("");
  const [sesiones, setSesiones] = useState(TYPE_DEFAULTS["AEP-2"].sesiones);
  const [requeridos, setRequeridos] = useState(TYPE_DEFAULTS["AEP-2"].requeridos);
  const [zona, setZona] = useState(defaultZona ?? zones[0]?.code ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const isDirty =
    nombre !== "" ||
    sede !== "" ||
    fecha !== "" ||
    fechaFin !== "" ||
    tipo !== "AEP-2" ||
    sesiones !== TYPE_DEFAULTS["AEP-2"].sesiones ||
    requeridos !== TYPE_DEFAULTS["AEP-2"].requeridos;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleTipoChange = (newTipo: EventType) => {
    setTipo(newTipo);
    const defaults = TYPE_DEFAULTS[newTipo];
    setSesiones(defaults.sesiones);
    setRequeridos(defaults.requeridos);
  };

  const touch = (field: string) => setTouched((prev) => new Set(prev).add(field));

  const handleBlur = (field: string, value: string) => {
    touch(field);
    const err = validateField(field, value, fecha);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  };

  const liveValidate = (field: string, value: string) => {
    if (!touched.has(field)) return;
    const err = validateField(field, value, fecha);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  };

  const dateDiffDays =
    fecha && fechaFin && fechaFin >= fecha
      ? Math.round(
          (new Date(fechaFin).getTime() - new Date(fecha).getTime()) / 86_400_000,
        ) + 1
      : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    const allFields: [string, string][] = [
      ["nombre", nombre],
      ["fecha", fecha],
      ["fechaFin", fechaFin],
      ["sede", sede],
      ["sesiones", sesiones],
      ["requeridos", requeridos],
    ];
    const errors: FieldErrors = {};
    for (const [field, value] of allFields) {
      const err = validateField(field, value, fecha);
      if (err) errors[field as keyof FieldErrors] = err;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched(new Set(allFields.map(([f]) => f)));
      return;
    }

    const nSesiones = Math.round(Number(sesiones));
    const nRequeridos = Math.round(Number(requeridos));
    setLoading(true);
    try {
      const comp = await api.createCompetition({
        nombre,
        tipo,
        fecha,
        fechaFin: fechaFin || fecha,
        sede,
        sesiones: nSesiones,
        requeridos: nRequeridos,
        zona,
      });
      router.push(`/events/${comp.id}`);
      router.refresh();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "No se pudo crear el campeonato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <SectionDivider title="Identificación" />

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
              Nombre del campeonato
            </label>
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                liveValidate("nombre", e.target.value);
              }}
              onBlur={(e) => handleBlur("nombre", e.target.value)}
              placeholder="Ej. Campeonato de España Absoluto"
              required
              className={cn(
                touched.has("nombre") && fieldErrors.nombre && "border-destructive",
              )}
            />
            <FieldError message={touched.has("nombre") ? fieldErrors.nombre : undefined} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Tipo AEP
              </label>
              <select
                value={tipo}
                onChange={(e) => handleTipoChange(e.target.value as EventType)}
                className={selectFieldClass}
                aria-label="Tipo AEP"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-subtle-muted">{TYPE_DESC[tipo]}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Zona
              </label>
              <select
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                className={selectFieldClass}
                aria-label="Zona"
              >
                {zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SectionDivider title="Fechas" />

          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                  Fecha inicio
                </label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    liveValidate("fecha", e.target.value);
                  }}
                  onBlur={(e) => handleBlur("fecha", e.target.value)}
                  required
                  className={cn(
                    touched.has("fecha") && fieldErrors.fecha && "border-destructive",
                  )}
                />
                <FieldError message={touched.has("fecha") ? fieldErrors.fecha : undefined} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                  Fecha fin
                </label>
                <Input
                  type="date"
                  value={fechaFin}
                  min={fecha || undefined}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    liveValidate("fechaFin", e.target.value);
                  }}
                  onBlur={(e) => handleBlur("fechaFin", e.target.value)}
                  className={cn(
                    touched.has("fechaFin") && fieldErrors.fechaFin && "border-destructive",
                  )}
                />
                <FieldError
                  message={touched.has("fechaFin") ? fieldErrors.fechaFin : undefined}
                />
              </div>
            </div>

            {fecha && fechaFin && fechaFin >= fecha && (
              <div className="flex items-center gap-2 rounded-md border border-border-muted bg-surface px-3 py-2 text-xs text-foreground-secondary">
                <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-mono">{fecha}</span>
                <span className="text-subtle-muted">→</span>
                <span className="font-mono">{fechaFin}</span>
                {dateDiffDays !== null && dateDiffDays > 1 && (
                  <span className="ml-auto text-subtle-muted">{dateDiffDays} días</span>
                )}
              </div>
            )}
          </div>

          <SectionDivider title="Sede" />

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
              Lugar de celebración
            </label>
            <Input
              value={sede}
              onChange={(e) => {
                setSede(e.target.value);
                liveValidate("sede", e.target.value);
              }}
              onBlur={(e) => handleBlur("sede", e.target.value)}
              required
              placeholder="Ciudad / pabellón"
              className={cn(
                touched.has("sede") && fieldErrors.sede && "border-destructive",
              )}
            />
            <FieldError message={touched.has("sede") ? fieldErrors.sede : undefined} />
          </div>

          <SectionDivider title="Configuración de tarima" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Sesiones
              </label>
              <Input
                type="number"
                min={1}
                max={6}
                value={sesiones}
                onChange={(e) => {
                  setSesiones(e.target.value);
                  liveValidate("sesiones", e.target.value);
                }}
                onBlur={(e) => handleBlur("sesiones", e.target.value)}
                className={cn(
                  touched.has("sesiones") && fieldErrors.sesiones && "border-destructive",
                )}
              />
              <FieldError
                message={touched.has("sesiones") ? fieldErrors.sesiones : undefined}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Plazas requeridas
              </label>
              <Input
                type="number"
                min={1}
                value={requeridos}
                onChange={(e) => {
                  setRequeridos(e.target.value);
                  liveValidate("requeridos", e.target.value);
                }}
                onBlur={(e) => handleBlur("requeridos", e.target.value)}
                className={cn(
                  touched.has("requeridos") && fieldErrors.requeridos && "border-destructive",
                )}
              />
              <FieldError
                message={touched.has("requeridos") ? fieldErrors.requeridos : undefined}
              />
            </div>
          </div>
          <p className="text-[11px] text-subtle-muted">
            Valores predeterminados para {tipo}. Puedes ajustarlos libremente.
          </p>

          {globalError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {globalError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Creando…" : "Crear campeonato"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/events">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
