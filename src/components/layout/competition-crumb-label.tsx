"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";

// Caché por sesión de navegación: el nombre de una competición no cambia entre
// migas, así que no hay que descargar la competición completa en CADA
// navegación a /competitions/[id] (antes: un fetch por visita).
const crumbNameCache = new Map<string, string>();
// Es un almacén externo y no un estado por componente: la página de la tarima
// lo rellena con el nombre que ya trae del servidor y la barra superior, que
// vive en el layout, se entera sin pedir nada.
const crumbListeners = new Set<() => void>();

function subscribeCrumbNames(listener: () => void) {
  crumbListeners.add(listener);
  return () => {
    crumbListeners.delete(listener);
  };
}

/** Guarda el nombre de un campeonato para la miga de pan y avisa a quien la pinta. */
export function seedCompetitionCrumb(competitionId: string, nombre: string) {
  if (!competitionId || !nombre || crumbNameCache.get(competitionId) === nombre) return;
  crumbNameCache.set(competitionId, nombre);
  for (const listener of crumbListeners) listener();
}

/**
 * Siembra la miga con el nombre que la página ya ha leído en el servidor. La
 * barra superior pedía `GET /api/v1/competitions/[id]` al montarse —sesión,
 * comprobación de zona y campeonato con sus asignaciones— solo para el nombre.
 * Efecto de layout: en una carga en frío el nombre está antes de pintar.
 */
export function CompetitionCrumbSeed({ id, nombre }: { id: string; nombre: string }) {
  useLayoutEffect(() => {
    seedCompetitionCrumb(id, nombre);
  }, [id, nombre]);
  return null;
}

/** Resuelve título de competición para breadcrumbs `/competitions/[id]`. */
export function useCompetitionCrumbLabel(fallback: string): string {
  const pathname = usePathname();
  const match = pathname.match(/^\/competitions\/([^/]+)(\/compensation)?$/);
  const competitionId = match?.[1] && match[1] !== "new" ? match[1] : undefined;
  const onCompensation = Boolean(match?.[2]);
  const cached = useSyncExternalStore(
    subscribeCrumbNames,
    () => (competitionId ? crumbNameCache.get(competitionId) : undefined),
    () => undefined,
  );

  useEffect(() => {
    // La página de la tarima siembra el nombre ella misma (CompetitionCrumbSeed).
    // Aquí no se puede esperar a que lo haga: con `loading.tsx`, en una
    // navegación de cliente este efecto corre antes de que la página monte, y
    // la petición saldría igual. La de compensación no lo siembra todavía, así
    // que ahí se mantiene la petición, solo si no viene ya de la tarima.
    if (!competitionId || !onCompensation || crumbNameCache.has(competitionId)) return;
    void api
      .getCompetition(competitionId)
      .then((competition) => seedCompetitionCrumb(competitionId, competition.nombre))
      .catch(() => {
        // Sin nombre se queda el texto de reserva, como antes.
      });
  }, [competitionId, onCompensation]);

  return (competitionId ? cached : undefined) ?? fallback;
}
