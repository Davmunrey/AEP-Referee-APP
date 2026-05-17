"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { Referee, RefereeLevel, RefereeStatus, Zone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";

const STATUSES: RefereeStatus[] = ["Activo", "Inactivo", "Sancionado"];

interface RefereeEditFormProps {
  referee: Referee;
  zones: Zone[];
  levels: RefereeLevel[];
}

export function RefereeEditForm({ referee, zones, levels }: RefereeEditFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(referee.nombre);
  const [zona, setZona] = useState(referee.zona);
  const [nivel, setNivel] = useState(referee.nivel);
  const [estado, setEstado] = useState(referee.estado);
  const [email, setEmail] = useState(referee.email ?? "");
  const [licencia, setLicencia] = useState(referee.licencia ?? "");
  const [disp, setDisp] = useState(referee.disp);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    nombre !== referee.nombre ||
    zona !== referee.zona ||
    nivel !== referee.nivel ||
    estado !== referee.estado ||
    email !== (referee.email ?? "") ||
    licencia !== (referee.licencia ?? "") ||
    disp !== referee.disp;

  const onCancel = () => {
    setNombre(referee.nombre);
    setZona(referee.zona);
    setNivel(referee.nivel);
    setEstado(referee.estado);
    setEmail(referee.email ?? "");
    setLicencia(referee.licencia ?? "");
    setDisp(referee.disp);
    setError(null);
    setSaved(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateReferee(referee.id, {
        nombre,
        zona,
        nivel,
        estado,
        email: email || undefined,
        licencia: licencia || undefined,
        disp,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editar ficha</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Sección: Identidad */}
          <div>
            <label htmlFor="ref-nombre" className="mb-1 block text-xs font-medium text-foreground-secondary">Nombre</label>
            <Input id="ref-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ref-zona" className="mb-1 block text-xs font-medium text-foreground-secondary">Zona</label>
              <select
                id="ref-zona"
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
              <label htmlFor="ref-nivel" className="mb-1 block text-xs font-medium text-foreground-secondary">Nivel</label>
              <select
                id="ref-nivel"
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
            <label htmlFor="ref-estado" className="mb-1 block text-xs font-medium text-foreground-secondary">Estado</label>
            <select
              id="ref-estado"
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ref-email" className="mb-1 block text-xs font-medium text-foreground-secondary">Email</label>
              <Input id="ref-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ref-licencia" className="mb-1 block text-xs font-medium text-foreground-secondary">Licencia</label>
              <Input id="ref-licencia" value={licencia} onChange={(e) => setLicencia(e.target.value)} />
            </div>
          </div>

          <label htmlFor="ref-disp" className="flex items-center gap-2 text-sm text-foreground-secondary">
            <input
              id="ref-disp"
              type="checkbox"
              checked={disp}
              onChange={(e) => setDisp(e.target.checked)}
              className="rounded border-border-strong"
            />
            Disponible para designaciones
          </label>

          {/* Action bar */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex-1 text-sm">
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
              {saved && !isDirty && (
                <p className="text-success">✓ Cambios guardados.</p>
              )}
              {isDirty && !error && (
                <p className="text-subtle-muted">Hay cambios sin guardar.</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Descartar
                </Button>
              )}
              <Button type="submit" size="sm" disabled={loading || !isDirty}>
                {loading ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
