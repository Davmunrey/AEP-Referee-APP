"use client";

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
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import type { AnalyticsPayload } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export function AnalyticsDashboard({ data }: { data: AnalyticsPayload }) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión"
        title="Estadísticas"
        description="Temporada 2026 · cobertura por zona, carga arbitral y eventos críticos"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Árbitros activos"
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
        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle>Cobertura por zona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {data.coverageByZone.map((z) => (
              <div key={z.zona}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-foreground-secondary">
                    {z.name} ({z.zona})
                  </span>
                  <span className="font-mono tabular-nums text-subtle-muted">{z.pct}%</span>
                </div>
                <Progress value={z.pct} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle>Árbitros más activos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border-muted p-0 pt-0">
            {data.topReferees.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-surface-hover"
              >
                <span className="text-sm text-foreground-secondary">
                  <span className="mr-2 font-mono text-[10px] text-subtle-muted">{i + 1}</span>
                  {r.nombre}
                </span>
                <span className="font-mono text-xs tabular-nums text-subtle-muted">
                  {r.eventos} evt
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border-muted pb-4">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <CardTitle>Eventos en estado crítico</CardTitle>
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
