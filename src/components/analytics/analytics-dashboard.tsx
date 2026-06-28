"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import type { AnalyticsPayload } from "@/lib/types";
import { ExportPreviewDialog } from "@/components/data-transfer/export-preview-dialog";
import { api } from "@/lib/api/client";
import { AlertTriangle, ArrowLeftRight, CalendarRange, Download, MapPin, Trophy, Users } from "lucide-react";

function coveragePct(filled: number, required: number) {
  if (required <= 0) return null;
  return Math.min(100, Math.round((filled / required) * 100));
}

function formatSlotCoverage(filled: number, required: number) {
  if (required <= 0) {
    return filled > 0 ? `${filled} sin plantilla` : "sin plantilla";
  }
  const pct = coveragePct(filled, required);
  return `${filled}/${required} (${pct}%)`;
}

export function AnalyticsDashboard({ data }: { data: AnalyticsPayload }) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportFilename = `estadisticas-${new Date().toISOString().slice(0, 10)}.csv`;
  const maxCompetitions = Math.max(...data.topReferees.map((r) => r.assignedCompetitions), 1);
  const yearCoveragePct = coveragePct(
    data.totals.filledSlots,
    data.totals.filledSlots + data.totals.openSlots,
  );

  const zonesWithActivity = useMemo(
    () =>
      [...data.activityByZone]
        .filter((row) => row.competitions > 0)
        .sort((a, b) => {
          const aScore = a.filledSlots + a.competitions;
          const bScore = b.filledSlots + b.competitions;
          return bScore - aScore || a.name.localeCompare(b.name, "es");
        }),
    [data.activityByZone],
  );

  return (
    <PageShell>
      <ExportPreviewDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        kind="analytics_export"
        fetchText={() => api.fetchAnalyticsExportText()}
        filename={exportFilename}
        mime="text/csv;charset=utf-8"
      />
      <PageHeader
        eyebrow="Gestión"
        title="Estadísticas"
        description={`Resumen ${data.selectedYear}: campeonatos, plazas de plantilla y asignaciones guardadas en tarima.`}
      >
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-hover focus-ring"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Exportar CSV
        </button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={`Campeonatos ${data.selectedYear}`} accent="blue" value={data.totals.competitions} />
        <StatCard
          label="Jueces distintos"
          accent="neutral"
          value={data.totals.uniqueAssignedReferees}
        />
        <StatCard label="Plazas cubiertas" accent="yellow" value={data.totals.filledSlots} />
        <StatCard label="Plazas abiertas" accent="red" value={data.totals.openSlots} />
        <StatCard label="Aprobaciones pendientes" accent="neutral" value={data.totals.pendingApprovals} />
      </div>

      {data.crossZoneSummary && data.crossZoneSummary.totalCrossZoneSlots > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200/80 bg-orange-50 px-4 py-3 text-sm dark:border-orange-900/40 dark:bg-orange-950/30">
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden="true" />
          <div className="text-orange-900 dark:text-orange-100">
            <p>
              <strong>{data.crossZoneSummary.totalCrossZoneSlots}</strong> plazas cubiertas por jueces de{" "}
              <strong>otra zona</strong> ({data.crossZoneSummary.pctOfFilledSlots}% de las{" "}
              {data.totals.filledSlots} plazas cubiertas).
            </p>
            <p className="mt-1 text-xs text-orange-800/90 dark:text-orange-200/80">
              Cuenta plazas, no personas: un mismo juez en varios puestos suma varias plazas externas.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Histórico por año</CardTitle>
            </div>
            <p className="text-xs text-subtle-muted">
              Plazas = huecos de plantilla. Cubiertas = asignaciones válidas en tarima.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable>
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>Año</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Campeonatos</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Plazas</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Cubiertas</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Jueces</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {data.yearlyHistory.map((row) => (
                  <DataTableRow key={row.year}>
                    <DataTableCell className="font-mono text-xs">{row.year}</DataTableCell>
                    <DataTableCell className="text-right">{row.competitions}</DataTableCell>
                    <DataTableCell className="text-right">{row.requiredSlots}</DataTableCell>
                    <DataTableCell className="text-right">
                      {formatSlotCoverage(row.filledSlots, row.requiredSlots)}
                    </DataTableCell>
                    <DataTableCell className="text-right">{row.uniqueAssignedReferees}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Actividad por zona · {data.selectedYear}</CardTitle>
            </div>
            <p className="text-xs text-subtle-muted">
              Solo zonas con campeonatos ese año. Jueces = distintos asignados / activos en el registro.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {zonesWithActivity.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-subtle-muted">
                No hay campeonatos registrados en {data.selectedYear}.
              </p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderRow>
                    <DataTableHeadCell>Zona</DataTableHeadCell>
                    <DataTableHeadCell className="text-right">Camp.</DataTableHeadCell>
                    <DataTableHeadCell className="text-right">Cubiertas</DataTableHeadCell>
                    <DataTableHeadCell
                      className="text-right"
                      title="Jueces distintos con plaza / jueces activos en el registro de la zona"
                    >
                      Jueces
                    </DataTableHeadCell>
                    <DataTableHeadCell
                      className="text-right"
                      title="Plazas cubiertas por jueces cuya zona de registro no coincide con la del campeonato"
                    >
                      Otra zona
                    </DataTableHeadCell>
                  </DataTableHeaderRow>
                </DataTableHead>
                <DataTableBody>
                  {zonesWithActivity.map((row) => (
                    <DataTableRow key={row.zona}>
                      <DataTableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                          <p className="text-[11px] text-subtle-muted">{row.zona}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-right">{row.competitions}</DataTableCell>
                      <DataTableCell className="text-right">
                        {formatSlotCoverage(row.filledSlots, row.requiredSlots)}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {row.uniqueAssignedReferees}/{row.activeReferees}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {(row.crossZoneSlots ?? 0) > 0 ? (
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {row.crossZoneSlots}
                          </span>
                        ) : (
                          <span className="text-subtle-muted">—</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
              <CardTitle>Jueces más asignados · {data.selectedYear}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border-muted p-0">
            {data.topReferees.length === 0 && (
              <p className="px-6 py-8 text-center text-xs text-subtle-muted">Sin asignaciones aún.</p>
            )}
            {data.topReferees.map((r, i) => {
              const barW = Math.round((r.assignedCompetitions / maxCompetitions) * 100);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 shrink-0 text-center font-mono text-xs font-bold tabular-nums text-subtle-muted">
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
                    <p className="mt-1 text-[11px] text-subtle-muted">{r.nivel}</p>
                  </div>
                  <span className="shrink-0 text-right font-mono text-xs tabular-nums text-subtle-muted">
                    {r.assignedCompetitions} camp.
                    <br />
                    {r.assignedSlots} plazas
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Lectura rápida</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5 text-sm text-foreground-secondary">
            <p>
              Año activo: <strong>{data.selectedYear}</strong>.
            </p>
            <p>
              Cobertura del año:{" "}
              <strong>{yearCoveragePct != null ? `${yearCoveragePct}%` : "—"}</strong>
              {yearCoveragePct != null && (
                <span className="text-subtle-muted">
                  {" "}
                  ({data.totals.filledSlots}/{data.totals.filledSlots + data.totals.openSlots} plazas)
                </span>
              )}
            </p>
            <p>
              Tasa de rechazo de propuestas: <strong>{data.rejectionRate}%</strong>.
            </p>
            <dl className="space-y-1.5 border-t border-border-muted pt-3 text-xs text-subtle-muted">
              <div>
                <dt className="font-medium text-foreground-secondary">Plazas cubiertas</dt>
                <dd>Huecos de plantilla con juez asignado (misma lógica que la lista de campeonatos).</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground-secondary">Jueces distintos</dt>
                <dd>Personas únicas con al menos una plaza válida en el año.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground-secondary">Otra zona</dt>
                <dd>
                  Plazas donde el juez no pertenece a la zona del campeonato. Puede superar el número de
                  jueces porque una persona puede cubrir varios puestos.
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border-muted pb-4">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          <CardTitle>Campeonatos críticos · {data.selectedYear}</CardTitle>
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
              title="Sin campeonatos críticos"
              description="No hay campeonatos críticos en el año seleccionado."
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
                        href={`/competitions/${e.id}`}
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
