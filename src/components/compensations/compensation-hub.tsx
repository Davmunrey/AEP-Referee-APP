"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/ui/metric-tile";
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
import { api } from "@/lib/api/client";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationHubSummary } from "@/lib/judge-compensation/hub-types";
import { formatDateRange } from "@/lib/utils";

interface CompensationHubProps {
  initialHub: CompensationHubSummary;
}

export function CompensationHub({ initialHub }: CompensationHubProps) {
  const [hub, setHub] = useState(initialHub);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        setHub(await api.getCompensationHub());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el panel");
      }
    });
  }, []);

  useEffect(() => {
    setHub(initialHub);
  }, [initialHub]);

  const { items, totalPendingKm, readyCount, confirmedTotal, provisionalTotal } = hub;
  // Lo confirmado es lo exportable; el resto está devengado pero espera km.
  const pendingAmount = Math.round((provisionalTotal - confirmedTotal) * 100) / 100;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Competiciones"
        title="Compensación de jueces"
        description="Acceso directo a facturación y recibos por campeonato, sin ir tarima a tarima."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Actualizar</span>
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href="/docs">
            <FileText className="h-3.5 w-3.5" />
            <span className="ml-1.5">Guía de compensación</span>
          </Link>
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive-border bg-destructive-muted px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Campeonatos con jueces" value={items.length} icon={Trophy} />
        <MetricTile
          label="Total confirmado"
          value={formatReceiptAmountEur(confirmedTotal)}
          icon={Banknote}
          tone="primary"
          hint={pendingAmount > 0 ? `+ ${formatReceiptAmountEur(pendingAmount)} pendiente de km` : undefined}
        />
        <MetricTile label="Listos para exportar" value={readyCount} icon={CheckCircle2} tone="success" />
        <MetricTile
          label="Jueces con km pendientes"
          value={totalPendingKm}
          icon={MapPin}
          tone={totalPendingKm > 0 ? "warning" : "neutral"}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Sin compensaciones pendientes"
          description="No hay campeonatos con jueces asignados en tarima. Cuando haya asignaciones, aparecerán aquí."
        >
          <Button asChild size="sm">
            <Link href="/competitions">Ir a campeonatos</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-muted">
          <DataTable>
            <DataTableHead>
              <DataTableHeaderRow>
                <DataTableHeadCell>Campeonato</DataTableHeadCell>
                <DataTableHeadCell>Fechas</DataTableHeadCell>
                <DataTableHeadCell>Sede</DataTableHeadCell>
                <DataTableHeadCell className="text-center">Jueces</DataTableHeadCell>
                <DataTableHeadCell>Estado</DataTableHeadCell>
                <DataTableHeadCell className="text-right">Total</DataTableHeadCell>
                <DataTableHeadCell />
              </DataTableHeaderRow>
            </DataTableHead>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow key={item.competitionId}>
                  <DataTableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{item.nombre}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-sm text-foreground-secondary">
                    {formatDateRange(item.fecha, item.fechaFin)}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="flex items-center gap-1 text-sm text-foreground-secondary">
                      <MapPin className="h-3 w-3 shrink-0 text-subtle-muted" />
                      <span className="truncate">{item.sede}</span>
                    </span>
                  </DataTableCell>
                  <DataTableCell className="text-center text-sm">{item.judgeCount}</DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EventStatusBadge status={item.estado} />
                      {item.readyForExport ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-muted px-1.5 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Listo
                        </span>
                      ) : item.pendingKmCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-1.5 py-0.5 text-[11px] font-medium text-warning">
                          <AlertCircle className="h-3 w-3" />
                          {item.pendingKmCount} km pend.
                        </span>
                      ) : item.issueCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-1.5 py-0.5 text-[11px] font-medium text-warning">
                          Revisar
                        </span>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-right text-sm font-medium">
                    {/* Antes: un guion mientras faltaran km, aunque el importe
                        estuviera calculado. La pantalla del campeonato ya
                        enseñaba el provisional; aquí se ocultaba. */}
                    {item.readyForExport ? (
                      formatReceiptAmountEur(item.grandTotal)
                    ) : item.provisionalTotal > 0 ? (
                      <span className="font-normal text-muted-foreground">
                        {formatReceiptAmountEur(item.provisionalTotal)}
                        <span className="ml-1 text-[11px]">prov.</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/competitions/${item.competitionId}/compensation`}>
                        Abrir
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}
    </PageShell>
  );
}
