"use client";

import { Button } from "@/components/ui/button";
import type { DashboardPayload, SessionUser } from "@/lib/types";
import { ArrowRight, Download, FileSearch, Plus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { canCreateCompetition } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function greet(nombre: string): string {
  const h = new Date().getHours();
  const firstName = nombre.split(" ")[0];
  if (h < 13) return `Buenos días, ${firstName}`;
  if (h < 20) return `Buenas tardes, ${firstName}`;
  return `Buenas noches, ${firstName}`;
}

export function DashboardHero({
  user,
  dashboard,
}: {
  user: SessionUser;
  dashboard: DashboardPayload;
}) {
  const pendingApprovals = dashboard.kpis.find((k) => k.label.includes("Aprobaciones"));
  const openSlots = dashboard.kpis.find((k) => k.label.includes("Plazas"));
  const criticalEvent = dashboard.coverage.find((c) => c.estado === "Crítico");
  const now = new Date();
  const quarter = `T${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
  const nextAction = dashboard.insights.find(
    (i) => (i.severity === "crítico" || i.severity === "alerta") && i.action,
  );

  const canCreate = canCreateCompetition(user.role);

  return (
    <div className="glass-panel-soft rounded-[1.6rem] p-4 sm:p-5 xl:p-5 2xl:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: greeting + context */}
        <div className="flex min-w-0 max-w-[44rem] items-start gap-3.5">
          <Image
            src="/assets/aep-mark.png"
            alt="AEP"
            width={48}
            height={48}
            className="hidden shrink-0 rounded-2xl sm:block"
            priority
          />
          <div className="min-w-0">
            <p className="friendly-label mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Panel operativo · {quarter}
            </p>
            <h1 className="text-[1.45rem] font-semibold tracking-tight text-foreground sm:text-[1.65rem] xl:text-[1.75rem] 2xl:text-[1.9rem]">
              {greet(user.nombre)}
            </h1>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
              {pendingApprovals && Number(pendingApprovals.value) > 0 ? (
                <>
                  Tienes{" "}
                  <span className="font-semibold text-primary">{pendingApprovals.value} aprobaciones</span>{" "}
                  pendientes
                </>
              ) : (
                <>Todo al día en aprobaciones</>
              )}
              {criticalEvent ? (
                <>
                  {" "}
                  — el roster de{" "}
                  <span className="font-semibold text-warning">{criticalEvent.nombre}</span> necesita
                  atención.
                </>
              ) : openSlots && Number(openSlots.value) > 0 ? (
                <>
                  {" "}
                  — quedan{" "}
                  <span className="font-semibold text-warning">{openSlots.value} plazas</span> por
                  cubrir.
                </>
              ) : (
                <> — buen momento para revisar la temporada.</>
              )}
            </p>

            {/* Priority action chip */}
            {nextAction?.action && (
              <Link
                href={nextAction.action.href}
                className={cn(
                  "mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  nextAction.severity === "crítico"
                    ? "border-destructive/30 bg-destructive-muted text-destructive hover:bg-destructive-muted/70"
                    : "border-warning/30 bg-warning-muted text-warning hover:bg-warning-muted/70",
                )}
              >
                <span className="font-semibold">{nextAction.title}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap items-center gap-2 xl:max-w-[26rem] xl:justify-end">
          {/* Quick-action row */}
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
            <Link href="/referees">
              <Users className="h-3.5 w-3.5" />
              Jueces
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
            <Link href="/approvals">
              <FileSearch className="h-3.5 w-3.5" />
              Aprobaciones
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
            <a href={api.analyticsExportUrl()} download>
              <Download className="h-3.5 w-3.5" />
              Exportar
            </a>
          </Button>
          {canCreate && (
            <Button size="sm" className="gap-1.5 rounded-xl" asChild>
              <Link href="/competitions/new">
                <Plus className="h-3.5 w-3.5" />
                Nuevo campeonato
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
