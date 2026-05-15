import { Button } from "@/components/ui/button";
import type { CurrentUser, DashboardPayload } from "@/lib/types";
import { Calendar, Download, Plus } from "lucide-react";
import Link from "next/link";

export function DashboardHero({
  user,
  dashboard,
}: {
  user: CurrentUser;
  dashboard: DashboardPayload;
}) {
  const firstName = user.nombre.split(" ")[0];
  const pendingApprovals = dashboard.kpis.find((k) => k.label.includes("Aprobaciones"));
  const openSlots = dashboard.kpis.find((k) => k.label.includes("Plazas"));
  const criticalEvent = dashboard.upcomingCompetitions.find((c) => c.estado === "Crítico");

  return (
    <div className="glass-panel-soft rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="friendly-label mb-3">Panel operativo · T2 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            Hola, {firstName} 👋
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {pendingApprovals && Number(pendingApprovals.value) > 0 ? (
              <>
                Tienes{" "}
                <span className="font-medium text-primary">{pendingApprovals.value} aprobaciones</span>{" "}
                pendientes
              </>
            ) : (
              <>Todo al día en aprobaciones</>
            )}
            {criticalEvent ? (
              <>
                {" "}
                y el roster de{" "}
                <span className="font-medium text-warning">{criticalEvent.nombre}</span> necesita
                atención.
              </>
            ) : openSlots && Number(openSlots.value) > 0 ? (
              <>
                {" "}
                y quedan{" "}
                <span className="font-medium text-warning">{openSlots.value} plazas</span> por
                cubrir.
              </>
            ) : (
              <> — buen día para revisar la temporada.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
            <Calendar className="h-3.5 w-3.5" />
            T2 2026
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
          <Button size="sm" className="gap-1.5 rounded-xl" asChild>
            <Link href="/events/new">
              <Plus className="h-3.5 w-3.5" />
              Nuevo campeonato
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
