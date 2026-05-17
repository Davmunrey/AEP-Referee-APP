"use client";

import { useState } from "react";
import Link from "next/link";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import type { AnalyticsPayload } from "@/lib/types";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { AlertTriangle, Download, Loader2, MapPin, Trophy } from "lucide-react";

function zonePctStyle(pct: number): { bar: string; text: string } {
  if (pct >= 75) return { bar: "bg-success", text: "text-success" };
  if (pct >= 50) return { bar: "bg-info", text: "text-info" };
  if (pct >= 25) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-primary", text: "text-primary" };
}

export function AnalyticsDashboard({ data }: { data: AnalyticsPayload }) {
  const [exporting, setExporting] = useState(false);
  const maxEvt = Math.max(...data.topReferees.map((r) => r.eventos), 1);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2500);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión"
        title="Estadísticas"
        description="Temporada 2026 · cobertura por zona, carga de jueces y eventos críticos"
      >
        <a
          href={api.analyticsExportUrl()}
          download
          onClick={handleExport}
          aria-disabled={exporting}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-hover focus-ring",
            exporting && "pointer-events-none opacity-60",
          )}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {exporting ? "Exportando…" : "Exportar CSV"}
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jueces activos"
          accent="blue"
          value={
            <>
              {data.totals.activeReferees}
              <span className="text-lg text-subtle-muted">/{data.totals.totalReferees}</span>
            </>
          }
        />
        <StatCard
          label="Aprobaciones pendientes"
          accent="red"
          value={data.totals.pendingApprovals}
        />
        <StatCard label="Plazas abiertas" accent="yellow" value={data.totals.openSlots} />
        <StatCard
          label="Tasa de rechazo"
          accent="neutral"
          value={`${data.rejectionRate}%`}
          sub="Propuestas rechazadas / total"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Zone coverage – heatmap-style coloured bars */}
        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Cobertura por zona</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {data.coverageByZone.map((z) => {
              const { bar, text } = zonePctStyle(z.pct);
              return (
                <div key={z.zona}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-foreground-secondary">
                      {z.name}{" "}
                      <span className="text-subtle-muted">({z.zona})</span>
                    </span>
                    <span className={cn("font-mono tabular-nums font-semibold", text)}>
                      {z.pct}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", bar)}
                      style={{ width: `${z.pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-0.5 text-right text-[10px] text-subtle-muted">
                    {z.eventos} evento{z.eventos !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top referees – ranked list with inline bars */}
        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
              <CardTitle>Jueces más activos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border-muted p-0">
            {data.topReferees.length === 0 && (
              <p className="px-6 py-8 text-center text-xs text-subtle-muted">Sin datos aún.</p>
            )}
            {data.topReferees.map((r, i) => {
              const barW = Math.round((r.eventos / maxEvt) * 100);
              const rankColor =
                i === 0
                  ? "text-warning"
                  : i === 1
                    ? "text-muted-foreground"
                    : i === 2
                      ? "text-primary-soft"
                      : "text-subtle-muted";
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center font-mono text-xs font-bold tabular-nums",
                      rankColor,
                    )}
                    aria-label={`Posición ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground-secondary">{r.nombre}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/50 transition-all duration-500"
                        style={{ width: `${barW}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-subtle-muted">
                    {r.eventos}&thinsp;evt
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Critical events */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border-muted pb-4">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          <CardTitle>Eventos en estado crítico</CardTitle>
          {data.criticalEvents.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {data.criticalEvents.length}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {data.criticalEvents.length === 0 ? (
            <EmptyState
              className="m-4 border-none bg-transparent"
              title="Todo bajo control"
              description="Ningún campeonato en estado crítico en este momento."
            />
          ) : (
            <DataTable>
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>Campeonato</DataTableHeadCell>
                  <DataTableHeadCell>Fecha</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Estado</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {data.criticalEvents.map((e) => (
                  <DataTableRow key={e.id}>
                    <DataTableCell>
                      <Link
                        href={`/events/${e.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {e.nombre}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {e.fecha}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <EventStatusBadge status={e.estado} />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
