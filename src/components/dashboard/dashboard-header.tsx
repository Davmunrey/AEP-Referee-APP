"use client";

import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { api } from "@/lib/api/client";
import { businessHour } from "@/lib/business-date";
import { daysUntil } from "@/lib/dashboard-intelligence";
import { canCreateCompetition } from "@/lib/permissions";
import { contar, palabra } from "@/lib/plural";
import type { DashboardPayload } from "@/lib/types";

// Hora en zona de negocio: con la hora local, el servidor (UTC) y el navegador
// (Madrid) calculaban saludos distintos entre las 22:00 y la medianoche, y
// React tenía que reescribir el encabezado al hidratar.
function greet(nombre: string): string {
  const h = businessHour();
  const firstName = nombre.split(" ")[0];
  if (h < 13) return `Buenos días, ${firstName}`;
  if (h < 20) return `Buenas tardes, ${firstName}`;
  return `Buenas noches, ${firstName}`;
}

function whenText(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "es hoy";
  if (days === 1) return "es mañana";
  return `es en ${days} días`;
}

/**
 * Una frase con lo que hay, hecha de cifras: plazas por cubrir, el campeonato
 * más cercano y la bandeja de aprobaciones. Sin logo ni fila de botones que
 * repiten la barra lateral.
 */
function summary(dashboard: DashboardPayload) {
  const open = dashboard.coverage.reduce((a, c) => a + c.open, 0);
  const next = dashboard.upcomingCompetitions[0];
  const pending = Number(dashboard.kpis.find((k) => k.id === "approvals")?.value ?? 0);
  const parts: React.ReactNode[] = [];

  if (dashboard.coverage.length === 0) {
    parts.push("No hay campeonatos programados.");
  } else if (open > 0) {
    parts.push(
      <span key="open">
        {palabra(open, "Queda", "Quedan")}{" "}
        <strong className="font-semibold text-foreground">{contar(open, "plaza", "plazas")}</strong> por cubrir en{" "}
        {contar(dashboard.coverage.length, "campeonato", "campeonatos")}.
      </span>,
    );
  } else {
    parts.push("Todas las plantillas están cubiertas.");
  }
  if (next) {
    parts.push(
      <span key="next">
        {" "}
        El próximo, <strong className="font-semibold text-foreground">{next.nombre}</strong>,{" "}
        {whenText(daysUntil(next.fecha))}.
      </span>,
    );
  }
  if (pending > 0) {
    parts.push(
      <span key="pending">
        {" "}
        {contar(pending, "aprobación espera", "aprobaciones esperan")} revisión.
      </span>,
    );
  }
  return parts;
}

export function DashboardHeader({ dashboard }: { dashboard: DashboardPayload }) {
  const user = dashboard.currentUser;
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[22px] font-semibold text-foreground sm:text-2xl">
          {greet(user.nombre)}
        </h1>
        {/* text-pretty: la frase cambia de longitud según los datos del día. */}
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{summary(dashboard)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DashboardLive generatedAt={dashboard.generatedAt} />
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={api.analyticsExportUrl()} download>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar
          </a>
        </Button>
        {canCreateCompetition(user.role) && (
          <Button size="sm" className="gap-1.5" asChild>
            <Link href="/competitions/new">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Nuevo campeonato
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
