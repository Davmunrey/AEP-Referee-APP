"use client";

import Link from "next/link";
import { listActiveTarimaCompetitions, rosterCoveragePct } from "@/lib/roster-active";
import type { Competition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { Progress } from "@/components/ui/progress";
import { LayoutGrid } from "lucide-react";

interface OpenRostersPanelProps {
  competitions: Competition[];
  maxItems?: number;
}

export function OpenRostersPanel({ competitions, maxItems = 6 }: OpenRostersPanelProps) {
  const active = listActiveTarimaCompetitions(competitions).slice(0, maxItems);
  if (active.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-border bg-surface/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Tarimas abiertas</h2>
        </div>
        <p className="text-xs text-subtle-muted">
          Campeonatos en curso — priorizados por cobertura pendiente
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((competition) => {
          const pct = rosterCoveragePct(competition);
          return (
            <li
              key={competition.id}
              className="flex flex-col gap-2 rounded-md border border-border-muted bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <EventTypeBadge tipo={competition.tipo} />
                <EventStatusBadge status={competition.estado} />
              </div>
              <p className="line-clamp-2 text-sm font-medium text-foreground">{competition.nombre}</p>
              <p className="text-[11px] text-subtle-muted">
                {competition.fecha} · {competition.sede}
              </p>
              <Progress value={pct} className="h-1.5" />
              <p className="font-mono text-[10px] text-subtle-muted">
                {competition.confirmados}/{competition.requeridos} · {pct}%
              </p>
              <Button size="sm" className="mt-auto w-full gap-1" asChild>
                <Link href={`/competitions/${competition.id}`}>Montar tarima</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
