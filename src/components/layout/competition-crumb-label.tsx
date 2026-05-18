"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";

/** Resuelve título de competición para breadcrumbs `/competitions/[id]`. */
export function useCompetitionCrumbLabel(fallback: string): string {
  const pathname = usePathname();
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    const match = pathname.match(/^\/competitions\/([^/]+)$/);
    const competitionId = match?.[1];
    if (!competitionId || competitionId === "new") {
      setLabel(fallback);
      return;
    }
    let cancelled = false;
    void api
      .getCompetition(competitionId)
      .then((competition) => {
        if (!cancelled) setLabel(competition.nombre);
      })
      .catch(() => {
        if (!cancelled) setLabel(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, fallback]);

  return label;
}
