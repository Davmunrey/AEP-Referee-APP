"use client";

import { zoneUiName } from "@/lib/aep-zones";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricStrip, MetricTile, type MetricTone } from "@/components/ui/metric-tile";
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
import type { AnalyticsPayload } from "@/lib/types";
const ExportPreviewDialog = dynamic(
  () => import("@/components/data-transfer/export-preview-dialog").then((m) => m.ExportPreviewDialog),
  { ssr: false },
);
import { api } from "@/lib/api/client";
import { coverageBarClass, coverageTextClass } from "@/lib/status-tone";
import { cn, formatDate } from "@/lib/utils";
import { ArrowLeftRight, Download } from "lucide-react";

function coveragePct(filled: number, required: number) {
  if (required <= 0) return null;
  return Math.min(100, Math.round((filled / required) * 100));
}

/** Tono de la cifra de cobertura en la franja: el mismo corte que las barras. */
function coverageMetricTone(pct: number | null): MetricTone {
  if (pct == null) return "neutral";
  if (pct >= 100) return "success";
  if (pct <= 0) return "neutral";
  return pct >= 50 ? "warning" : "danger";
}

/**
 * Barra de cobertura con el color común de `status-tone` (verde completa,
 * ámbar a medias, rojo crítica). Antes iba con su propio corte (80 / 40) y
 * una píldora de color con el porcentaje que repetía lo que dice la barra.
 */
function CoverageMeter({
  filled,
  required,
  className,
}: {
  filled: number;
  required: number;
  className?: string;
}) {
  const noTemplate = required <= 0;
  const pct = coveragePct(filled, required) ?? 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="text-foreground-secondary">{noTemplate ? "Sin plantilla" : `${filled}/${required}`}</span>
        {!noTemplate && <span className={cn("font-medium", coverageTextClass(pct))}>{pct}%</span>}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-active"
        role="progressbar"
        aria-label={noTemplate ? "Sin plantilla" : `Cobertura ${filled} de ${required}`}
        aria-valuenow={noTemplate ? 0 : pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {!noTemplate && (
          <div className={cn("h-full rounded-full", coverageBarClass(pct))} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

const GLOSARIO = [
  {
    title: "Plazas cubiertas",
    body: "Huecos de plantilla con juez asignado. Misma lógica que la lista de campeonatos.",
  },
  {
    title: "Jueces distintos",
    body: "Personas únicas con al menos una plaza válida en el año.",
  },
  {
    title: "Otra zona (Ext.)",
    body: "Puestos cubiertos por jueces cuya zona de registro no coincide con la del campeonato.",
  },
];

export function AnalyticsDashboard({ data }: { data: AnalyticsPayload }) {
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  // Años naturales seleccionables (más reciente primero).
  const yearOptions = useMemo(
    () => [...data.availableYears].sort((a, b) => b - a),
    [data.availableYears],
  );
  const exportFilename = `estadisticas-${new Date().toISOString().slice(0, 10)}.csv`;
  const maxCompetitions = Math.max(...data.topReferees.map((r) => r.assignedCompetitions), 1);

  const totalPlazas = data.totals.filledSlots + data.totals.openSlots;
  const yearCoveragePct = coveragePct(data.totals.filledSlots, totalPlazas);

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
      {/* Montaje condicional: no monta el diálogo (ni su estado) hasta abrirlo. */}
      {exportOpen && (
        <ExportPreviewDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          kind="analytics_export"
          fetchText={() => api.fetchAnalyticsExportText(data.selectedYear)}
          filename={exportFilename}
          mime="text/csv;charset=utf-8"
        />
      )}

      <PageHeader
        title="Estadísticas"
        description={`Resumen ${data.selectedYear} · campeonatos, plazas de plantilla y asignaciones en tarima.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {yearOptions.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Año natural"
            >
              {yearOptions.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => router.push(`/analytics?year=${y}`)}
                  aria-pressed={y === data.selectedYear}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs font-medium tabular-nums transition-colors focus-ring sm:h-8",
                    y === data.selectedYear
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-subtle-muted hover:bg-surface-hover",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </PageHeader>

      {/* Resumen anual: la franja de cifras común. Antes, un «33 %» enorme en
          un recuadro gris junto a cuatro tarjetas pequeñas. */}
      <MetricStrip columns={5} label={`Resumen ${data.selectedYear}`}>
        <MetricTile
          label={`Cobertura ${data.selectedYear}`}
          value={yearCoveragePct != null ? `${yearCoveragePct}%` : "—"}
          tone={coverageMetricTone(yearCoveragePct)}
          hint={`${data.totals.filledSlots} de ${totalPlazas} plazas`}
          // Cinco cifras en dos columnas dejarían un hueco: en móvil la
          // cobertura, que es la principal, ocupa la fila entera.
          className="col-span-2 sm:col-span-1"
        />
        <MetricTile label="Campeonatos" value={data.totals.competitions} />
        <MetricTile label="Jueces distintos" value={data.totals.uniqueAssignedReferees} hint="Con al menos una plaza" />
        <MetricTile
          label="Rechazo de propuestas"
          value={data.rejectionRate === null ? "—" : `${data.rejectionRate}%`}
          hint="Año en curso"
        />
        <MetricTile
          label="Por aprobar"
          hint="Propuestas de tarima"
          value={data.totals.pendingApprovals}
          tone={data.totals.pendingApprovals > 0 ? "warning" : "neutral"}
          href="/approvals"
        />
      </MetricStrip>

      {data.crossZoneSummary && data.crossZoneSummary.totalCrossZoneSlots > 0 && (
        <section className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 text-sm text-foreground-secondary">
            <p className="font-medium text-foreground">
              {data.crossZoneSummary.totalCrossZoneSlots} plazas con juez de otra zona
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {data.crossZoneSummary.pctOfFilledSlots}% de las {data.totals.filledSlots} plazas cubiertas.
              Cuenta puestos, no personas: un juez en varios roles suma varias plazas externas.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle className="text-sm">Histórico por año</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Plazas de plantilla y asignaciones válidas en tarima.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable className="data-table-zebra">
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>Año</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Camp.</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Plazas</DataTableHeadCell>
                  <DataTableHeadCell>Cobertura</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Jueces</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {data.yearlyHistory.map((row) => (
                  <DataTableRow key={row.year}>
                    <DataTableCell className="font-medium text-foreground">{row.year}</DataTableCell>
                    <DataTableCell className="text-right tabular-nums">{row.competitions}</DataTableCell>
                    <DataTableCell className="text-right tabular-nums text-muted-foreground">
                      {row.requiredSlots}
                    </DataTableCell>
                    <DataTableCell className="min-w-[140px]">
                      <CoverageMeter filled={row.filledSlots} required={row.requiredSlots} />
                    </DataTableCell>
                    <DataTableCell className="text-right tabular-nums">{row.uniqueAssignedReferees}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle className="text-sm">Actividad por zona · {data.selectedYear}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Zonas con campeonatos. Jueces = asignados / activos en registro.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {zonesWithActivity.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No hay campeonatos registrados en {data.selectedYear}.
              </p>
            ) : (
              <DataTable className="data-table-zebra">
                <DataTableHead>
                  <DataTableHeaderRow>
                    <DataTableHeadCell>Zona</DataTableHeadCell>
                    <DataTableHeadCell className="text-right">Camp.</DataTableHeadCell>
                    <DataTableHeadCell>Cobertura</DataTableHeadCell>
                    <DataTableHeadCell
                      className="text-right"
                      title="Jueces distintos con plaza / activos en el registro"
                    >
                      Jueces
                    </DataTableHeadCell>
                    <DataTableHeadCell
                      className="text-right"
                      title="Plazas cubiertas por jueces de otra zona"
                    >
                      Ext.
                    </DataTableHeadCell>
                  </DataTableHeaderRow>
                </DataTableHead>
                <DataTableBody>
                  {zonesWithActivity.map((row) => (
                    <DataTableRow key={row.zona}>
                      <DataTableCell>
                        {/* Antes: el código («NOROESTE») y el nombre («1- NOROESTE»),
                            que dicen lo mismo dos veces. */}
                        <span className="truncate text-sm font-medium text-foreground" title={row.name}>
                          {zoneUiName(row.zona)}
                        </span>
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{row.competitions}</DataTableCell>
                      <DataTableCell className="min-w-[132px]">
                        <CoverageMeter filled={row.filledSlots} required={row.requiredSlots} />
                      </DataTableCell>
                      <DataTableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{row.uniqueAssignedReferees}</span>
                        <span className="text-subtle-muted"> / {row.activeReferees}</span>
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {(row.crossZoneSlots ?? 0) > 0 ? (
                          <span className="inline-flex min-w-[2rem] justify-end rounded-md bg-warning-muted px-1.5 py-0.5 text-xs font-semibold text-warning">
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
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle className="text-sm">Jueces más asignados · {data.selectedYear}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topReferees.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin asignaciones aún.</p>
            ) : (
              <ol className="divide-y divide-border-muted">
                {data.topReferees.map((r, i) => {
                  const barW = Math.round((r.assignedCompetitions / maxCompetitions) * 100);
                  // Un recuento, no un estado: barra neutra. Antes, salmón a
                  // todo el ancho y puestos 1-3 en ámbar, gris y azul.
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.nombre}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{r.nivel}</span>
                        </p>
                        <div className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-active">
                          <div
                            className="h-full rounded-full bg-foreground/60"
                            style={{ width: `${barW}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="font-medium text-foreground">{r.assignedCompetitions} camp.</p>
                        <p className="mt-0.5 text-muted-foreground">{r.assignedSlots} plazas</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle className="text-sm">Glosario</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <dl className="space-y-3 text-xs leading-relaxed">
              {GLOSARIO.map((item) => (
                <div key={item.title}>
                  <dt className="font-semibold text-foreground">{item.title}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{item.body}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0 border-b border-border-muted pb-4">
          <CardTitle className="text-sm">Campeonatos críticos · {data.selectedYear}</CardTitle>
          {data.criticalEvents.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">{data.criticalEvents.length}</span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {data.criticalEvents.length === 0 ? (
            <EmptyState
              className="m-4 border-none bg-transparent"
              title="Sin campeonatos críticos"
              description="No hay campeonatos con cobertura muy baja en el año seleccionado."
            />
          ) : (
            <DataTable className="data-table-zebra">
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
                        className="rounded-sm font-medium text-foreground transition-colors hover:text-primary focus-ring"
                      >
                        {e.nombre}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(e.fecha)}</DataTableCell>
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
