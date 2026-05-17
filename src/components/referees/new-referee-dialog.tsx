"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { RefereeLevel, RefereeStatus, Zone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";

const STATUSES: RefereeStatus[] = ["Activo", "Inactivo", "Sancionado"];

interface NewRefereeDialogProps {
  zones: Zone[];
  levels: RefereeLevel[];
  open: boolean;
  onClose: () => void;
}

export function NewRefereeDialog({ zones, levels, open, onClose }: NewRefereeDialogProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState(zones[0]?.code ?? "");
  const [nivel, setNivel] = useState<RefereeLevel>(levels[0] ?? "Regional");
  const [estado, setEstado] = useState<RefereeStatus>("Activo");
  const [email, setEmail] = useState("");
  const [licencia, setLicencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const referee = await api.createReferee({
        nombre,
        zona,
        nivel,
        estado,
        email: email || undefined,
        licencia: licencia || undefined,
      });
      onClose();
      router.push(`/referees/${referee.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el juez");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-referee-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-0 shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <h3 id="new-referee-title" className="text-base font-semibold text-foreground">
              Nuevo juez
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          {/* Section: Datos principales */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle-muted">
              Datos principales
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                Nombre completo <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej. Juan García López"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                  Zona <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <select
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  className={selectFieldClass}
                >
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                  Nivel <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as RefereeLevel)}
                  className={selectFieldClass}
                >
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as RefereeStatus)}
                className={selectFieldClass}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Datos opcionales */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle-muted">
              Datos opcionales
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juez@ejemplo.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground-secondary">Licencia</label>
              <Input
                value={licencia}
                onChange={(e) => setLicencia(e.target.value)}
                placeholder="Nº de licencia AEP"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive-border bg-destructive-muted px-3 py-2"
            >
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading ? "Guardando…" : "Crear juez"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
