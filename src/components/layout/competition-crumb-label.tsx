"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";

// Caché por sesión de navegación: el nombre de una competición no cambia entre
// migas, así que no hay que descargar la competición completa en CADA
// navegación a /competitions/[id] (antes: un fetch por visita).
const crumbNameCache = new Map<string, string>();

/** Resuelve título de competición para breadcrumbs `/competitions/[id]`. */
export function useCompetitionCrumbLabel(fallback: string): string {
  const pathname = usePathname();
  const match = pathname.match(/^\/competitions\/([^/]+)$/);
  const competitionId = match?.[1];
  const cached = competitionId ? crumbNameCache.get(competitionId) : undefined;
  const [label, setLabel] = useState(cached ?? fallback);

  useEffect(() => {
    if (!competitionId || competitionId === "new") {
      setLabel(fallback);
      return;
    }
    const hit = crumbNameCache.get(competitionId);
    if (hit) {
      setLabel(hit);
      return;
    }
    let cancelled = false;
    void api
      .getCompetition(competitionId)
      .then((competition) => {
        crumbNameCache.set(competitionId, competition.nombre);
        if (!cancelled) setLabel(competition.nombre);
      })
      .catch(() => {
        if (!cancelled) setLabel(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId, fallback]);

  return label;
}
