"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { EventType, Zone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";

const EVENT_TYPES: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];

interface NewCompetitionFormProps {
  zones: Zone[];
  defaultZona?: string;
}

export function NewCompetitionForm({ zones, defaultZona }: NewCompetitionFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<EventType>("AEP-2");
  const [fecha, setFecha] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [sede, setSede] = useState("");
  const [sesiones, setSesiones] = useState("3");
  const [requeridos, setRequeridos] = useState("9");
  const [zona, setZona] = useState(defaultZona ?? zones[0]?.code ?? "MAD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const comp = await api.createCompetition({
        nombre,
        tipo,
        fecha,
        fechaFin: fechaFin || fecha,
        sede,
        sesiones: Number(sesiones) || 3,
        requeridos: Number(requeridos) || 9,
        zona,
      });
      router.push(`/events/${comp.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el campeonato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Datos del campeonato</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Nombre</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Tipo AEP</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as EventType)}
                className={selectFieldClass}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Fecha inicio</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Fecha fin</label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-subtle-muted">Sede</label>
            <Input value={sede} onChange={(e) => setSede(e.target.value)} required placeholder="Ciudad / pabellón" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Sesiones</label>
              <Input
                type="number"
                min={1}
                max={6}
                value={sesiones}
                onChange={(e) => setSesiones(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-subtle-muted">Plazas requeridas</label>
              <Input
                type="number"
                min={1}
                value={requeridos}
                onChange={(e) => setRequeridos(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
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
