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
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Nombre</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Licencia</label>
              <Input value={licencia} onChange={(e) => setLicencia(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground-secondary">
            <input
              type="checkbox"
              checked={disp}
              onChange={(e) => setDisp(e.target.checked)}
              className="rounded border-border-strong"
            />
            Disponible para designaciones
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-success">Cambios guardados.</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
