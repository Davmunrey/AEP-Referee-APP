"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { tokens } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarRange,
  Download,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";

function coveragePct(filled: number, required: number) {
  if (required <= 0) return null;
  return Math.min(100, Math.round((filled / required) * 100));
}

function coverageTone(pct: number | null, noTemplate: boolean) {
  if (noTemplate) {
    return {
      bar: "bg-muted",
      value: tokens.text.muted,
      pill: "border-border-muted bg-surface text-muted-foreground",
    };
  }
  if (pct == null) {
    return {
      bar: "bg-muted",
      value: tokens.text.muted,
      pill: "border-border-muted bg-surface text-muted-foreground",
    };
  }
  if (pct >= 80) {
    return {
      bar: "bg-success",
      value: tokens.text.success,
      pill: "border-success-border bg-success-muted text-success",
    };
  }
  if (pct >= 40) {
    return {
      bar: "bg-warning",
      value: tokens.text.warning,
      pill: "border-warning-border bg-warning-muted text-warning",
    };
  }
  return {
    bar: "bg-destructive",
    value: tokens.text.destructive,
    pill: "border-destructive-border bg-destructive-muted text-destructive",
  };
}

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
  const pct = coveragePct(filled, required);
  const tone = coverageTone(pct, noTemplate);
  const width = noTemplate ? 0 : (pct ?? 0);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium tabular-nums", tone.value)}>
          {noTemplate ? "Sin plantilla" : `${filled}/${required}`}
        </span>
        {!noTemplate && pct != null && (
          <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold", tone.pill)}>
            {pct}%
          </span>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-active"
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full transition-all duration-500", tone.bar)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border-muted bg-surface/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-subtle-muted">{hint}</p> : null}
    </div>
  );
}

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
  const yearTone = coverageTone(yearCoveragePct, totalPlazas <= 0);

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
    <PageShell className="space-y-5">
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
        eyebrow="Gestión"
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
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors",
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

      {/* Resumen anual */}
      <section className="glass-panel-soft overflow-hidden rounded-2xl">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,200px)_1fr] lg:items-center lg:gap-6 lg:p-5">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl border",
                yearTone.pill,
              )}
              aria-label={`Cobertura anual ${yearCoveragePct ?? 0} por ciento`}
            >
              <span className={cn("text-3xl font-bold tabular-nums tracking-tight", yearTone.value)}>
                {yearCoveragePct != null ? `${yearCoveragePct}%` : "—"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Cobertura {data.selectedYear}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.totals.filledSlots} cubiertas · {data.totals.openSlots} abiertas
              </p>
              <CoverageMeter filled={data.totals.filledSlots} required={totalPlazas} className="mt-3 max-w-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryMetric label="Campeonatos" value={data.totals.competitions} />
            <SummaryMetric label="Jueces distintos" value={data.totals.uniqueAssignedReferees} hint="Con al menos una plaza" />
            <SummaryMetric
              label="Rechazo propuestas"
              value={`${data.rejectionRate}%`}
              hint="Año en curso"
            />
            <SummaryMetric
              label="Pendientes"
              value={data.totals.pendingApprovals}
              hint="Aprobaciones"
            />
          </div>
        </div>
      </section>

      {data.crossZoneSummary && data.crossZoneSummary.totalCrossZoneSlots > 0 && (
        <section className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-subtle px-4 py-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-warning-border bg-warning-muted">
            <ArrowLeftRight className="h-4 w-4 text-warning" aria-hidden="true" />
          </span>
          <div className="min-w-0 text-sm text-foreground-secondary">
            <p className="font-medium text-foreground">
              {data.crossZoneSummary.totalCrossZoneSlots} plazas con juez de otra zona
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {data.crossZoneSummary.pctOfFilledSlots}% de las {data.totals.filledSlots} plazas cubiertas.
              Cuenta puestos, no personas: un juez en varios roles suma varias plazas externas.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted bg-surface/30 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-muted">
                <CalendarRange className="h-4 w-4 text-info" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-sm">Histórico por año</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Plazas de plantilla y asignaciones válidas en tarima.
                </CardDescription>
              </div>
            </div>
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
                    <DataTableCell className="font-mono text-xs font-semibold text-primary">{row.year}</DataTableCell>
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
          <CardHeader className="border-b border-border-muted bg-surface/30 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-muted">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-sm">Actividad por zona · {data.selectedYear}</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Zonas con campeonatos. Jueces = asignados / activos en registro.
                </CardDescription>
              </div>
            </div>
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
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-md border border-border-muted bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                            {row.zona}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{row.competitions}</DataTableCell>
                      <DataTableCell className="min-w-[132px]">
                        <CoverageMeter filled={row.filledSlots} required={row.requiredSlots} />
                      </DataTableCell>
                      <DataTableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{row.uniqueAssignedReferees}</span>
                        <span className="text-subtle-muted"> / {row.activeReferees}</span>
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {(row.crossZoneSlots ?? 0) > 0 ? (
                          <span className="inline-flex min-w-[2rem] justify-end rounded-full border border-warning-border bg-warning-muted px-2 py-0.5 font-mono text-xs font-semibold text-warning">
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted bg-surface/30 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-muted">
                <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
              </span>
              <CardTitle className="text-sm">Jueces más asignados · {data.selectedYear}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border-muted p-0">
            {data.topReferees.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Sin asignaciones aún.</p>
            )}
            {data.topReferees.map((r, i) => {
              const barW = Math.round((r.assignedCompetitions / maxCompetitions) * 100);
              const rankTone =
                i === 0
                  ? "border-warning-border bg-warning-muted text-warning"
                  : i === 1
                    ? "border-border-strong bg-surface text-foreground-secondary"
                    : i === 2
                      ? "border-info-border bg-info-muted text-info"
                      : "border-border-muted bg-surface text-muted-foreground";
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold tabular-nums",
                      rankTone,
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.nombre}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-active">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${barW}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{r.nivel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {r.assignedCompetitions} camp.
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {r.assignedSlots} plazas
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border-muted bg-surface/30 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-muted">
                <Users className="h-4 w-4 text-success" aria-hidden="true" />
              </span>
              <CardTitle className="text-sm">Glosario</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-1">
            {[
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
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border-muted bg-surface/50 px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3 border-b border-border-muted bg-surface/30 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive-muted">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">Campeonatos críticos · {data.selectedYear}</CardTitle>
          </div>
          {data.criticalEvents.length > 0 && (
            <span className="rounded-full border border-destructive-border bg-destructive-muted px-2.5 py-0.5 font-mono text-xs font-semibold text-destructive">
              {data.criticalEvents.length}
            </span>
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
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {e.nombre}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">{e.fecha}</DataTableCell>
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
