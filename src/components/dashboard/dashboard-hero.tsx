"use client";

import { Button } from "@/components/ui/button";
import type { DashboardPayload, SessionUser } from "@/lib/types";
import { ArrowRight, Download, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function DashboardHero({
  user,
  dashboard,
}: {
  user: SessionUser;
  dashboard: DashboardPayload;
}) {
  const firstName = user.nombre.split(" ")[0];
  const pendingApprovals = dashboard.kpis.find((k) => k.label.includes("Aprobaciones"));
  const openSlots = dashboard.kpis.find((k) => k.label.includes("Plazas"));
  const criticalEvent = dashboard.coverage.find((c) => c.estado === "Crítico");
  const now = new Date();
  const quarter = `T${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
  const nextAction = dashboard.insights.find(
    (i) => (i.severity === "crítico" || i.severity === "alerta") && i.action,
  );

  return (
    <div className="glass-panel-soft rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-2xl items-start gap-5">
          <Image
            src="/assets/aep-mark.png"
            alt="AEP"
            width={72}
            height={72}
            className="hidden shrink-0 sm:block"
            priority
          />
          <div>
            <p className="friendly-label mb-3">Panel operativo · {quarter}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              Hola, {firstName}
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
            {nextAction?.action && (
              <Link
                href={nextAction.action.href}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-colors",
                  nextAction.severity === "crítico"
                    ? "border-destructive-border bg-destructive-muted text-destructive hover:bg-destructive-muted/70"
                    : "border-warning-border bg-warning-muted text-warning hover:bg-warning-muted/70",
                )}
              >
                <span className="uppercase tracking-wide opacity-70">
                  Acción prioritaria
                </span>
                <span className="font-semibold">{nextAction.title}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" asChild>
            <a href={api.analyticsExportUrl()} download>
              <Download className="h-3.5 w-3.5" />
              Exportar
            </a>
          </Button>
          {(user.role === "super_admin" || user.role === "delegado_zona") && (
            <Button size="sm" className="gap-1.5 rounded-xl" asChild>
              <Link href="/events/new">
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
