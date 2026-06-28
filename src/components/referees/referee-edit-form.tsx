"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { Referee, RefereeLevel, RefereeStatus, Zone } from "@/lib/types";
import { AddressAutocompleteField } from "@/components/maps/address-autocomplete-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";

const STATUSES: RefereeStatus[] = ["Activo", "Inactivo"];

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
  const [localidad, setLocalidad] = useState(referee.localidad ?? "");
  const [domicilio, setDomicilio] = useState(referee.domicilio ?? "");
  const [domicilioCoords, setDomicilioCoords] = useState<{ lat: number; lng: number } | null>(
    referee.domicilioLat != null && referee.domicilioLng != null
      ? { lat: referee.domicilioLat, lng: referee.domicilioLng }
      : null,
  );
  const [telefono, setTelefono] = useState(referee.telefono ?? "");
  const [genero, setGenero] = useState(referee.genero ?? "");
  const [antiguedad, setAntiguedad] = useState(referee.antiguedad ?? "");
  const [notas, setNotas] = useState(referee.notas ?? "");
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
    localidad !== (referee.localidad ?? "") ||
    domicilio !== (referee.domicilio ?? "") ||
    domicilioCoords?.lat !== referee.domicilioLat ||
    domicilioCoords?.lng !== referee.domicilioLng ||
    telefono !== (referee.telefono ?? "") ||
    genero !== (referee.genero ?? "") ||
    antiguedad !== (referee.antiguedad ?? "") ||
    notas !== (referee.notas ?? "") ||
    disp !== referee.disp;

  const onCancel = () => {
    setNombre(referee.nombre);
    setZona(referee.zona);
    setNivel(referee.nivel);
    setEstado(referee.estado);
    setEmail(referee.email ?? "");
    setLicencia(referee.licencia ?? "");
    setLocalidad(referee.localidad ?? "");
    setDomicilio(referee.domicilio ?? "");
    setDomicilioCoords(
      referee.domicilioLat != null && referee.domicilioLng != null
        ? { lat: referee.domicilioLat, lng: referee.domicilioLng }
        : null,
    );
    setTelefono(referee.telefono ?? "");
    setGenero(referee.genero ?? "");
    setAntiguedad(referee.antiguedad ?? "");
    setNotas(referee.notas ?? "");
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
        localidad: localidad || undefined,
        domicilio: domicilio || undefined,
        ...(domicilioCoords ? { domicilioLat: domicilioCoords.lat, domicilioLng: domicilioCoords.lng } : {}),
        telefono: telefono || undefined,
        genero: genero || undefined,
        antiguedad: antiguedad || undefined,
        notas: notas || undefined,
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
              disabled={referee.estado === "Sancionado"}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {referee.estado === "Sancionado" && (
              <p className="mt-1 text-xs text-warning">
                Sancionado — gestiona en el panel «Sanciones» (revocar o esperar fin).
              </p>
            )}
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
            <div>
              <label htmlFor="ref-localidad" className="mb-1 block text-xs font-medium text-foreground-secondary">Localidad</label>
              <Input id="ref-localidad" value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <AddressAutocompleteField
                label="Domicilio (compensación km)"
                value={domicilio}
                onValueChange={(value) => {
                  setDomicilio(value);
                  setDomicilioCoords(null);
                }}
                onPlaceSelect={(place) => {
                  setDomicilio(place.address);
                  setDomicilioCoords({ lat: place.lat, lng: place.lng });
                }}
                placeholder="Calle, número, ciudad"
                coordsOk={domicilioCoords != null || (referee.domicilioLat != null && referee.domicilioLng != null)}
                coordsHint={
                  domicilioCoords || (referee.domicilioLat != null && referee.domicilioLng != null)
                    ? `Ubicación OpenStreetMap OK (${(domicilioCoords?.lat ?? referee.domicilioLat)?.toFixed(4)}, ${(domicilioCoords?.lng ?? referee.domicilioLng)?.toFixed(4)})`
                    : domicilio.trim()
                      ? "Selecciona una sugerencia de la lista o guarda para geocodificar al guardar."
                      : undefined
                }
                hint="Usado para calcular km hasta la sede del campeonato."
              />
            </div>
            <div>
              <label htmlFor="ref-telefono" className="mb-1 block text-xs font-medium text-foreground-secondary">Teléfono</label>
              <Input id="ref-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ref-genero" className="mb-1 block text-xs font-medium text-foreground-secondary">Género</label>
              <Input id="ref-genero" value={genero} onChange={(e) => setGenero(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ref-antiguedad" className="mb-1 block text-xs font-medium text-foreground-secondary">Antigüedad</label>
              <Input id="ref-antiguedad" type="date" value={antiguedad} onChange={(e) => setAntiguedad(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="ref-notas" className="mb-1 block text-xs font-medium text-foreground-secondary">Notas</label>
            <textarea
              id="ref-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
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
