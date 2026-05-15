"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [zona, setZona] = useState(zones[0]?.code ?? "MAD");
  const [nivel, setNivel] = useState<RefereeLevel>(levels[0] ?? "Regional");
  const [estado, setEstado] = useState<RefereeStatus>("Activo");
  const [email, setEmail] = useState("");
  const [licencia, setLicencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError(err instanceof Error ? err.message : "No se pudo crear el árbitro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-referee-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl"
      >
        <h3 id="new-referee-title" className="text-lg font-semibold text-foreground">
          Nuevo árbitro
        </h3>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Nombre completo</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Zona</label>
              <select value={zona} onChange={(e) => setZona(e.target.value)} className={selectFieldClass}>
                {zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Nivel</label>
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
            <label className="mb-1 block text-xs text-subtle-muted">Estado</label>
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
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Email (opcional)</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Licencia (opcional)</label>
            <Input value={licencia} onChange={(e) => setLicencia(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Crear árbitro"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
