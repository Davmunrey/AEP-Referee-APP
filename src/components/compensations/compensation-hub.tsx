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
} from "lucide-react";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { MetricStrip, MetricTile } from "@/components/ui/metric-tile";
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
import { contar } from "@/lib/plural";

type HubItem = CompensationHubSummary["items"][number];

/** Qué le falta a un campeonato para exportarse, o que ya está listo. */
function ExportChip({ item }: { item: HubItem }) {
  if (item.readyForExport) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success-muted px-1.5 py-0.5 text-2xs font-medium text-success">
        <CheckCircle2 className="h-3 w-3" />
        Listo
      </span>
    );
  }
  if (item.pendingKmCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-1.5 py-0.5 text-2xs font-medium text-warning">
        <AlertCircle className="h-3 w-3" />
        {item.pendingKmCount} km pend.
      </span>
    );
  }
  if (item.issueCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-1.5 py-0.5 text-2xs font-medium text-warning">
        Revisar
      </span>
    );
  }
  return null;
}

/**
 * Importe del campeonato. Antes: un guion mientras faltaran km, aunque el
 * importe estuviera calculado. La pantalla del campeonato ya enseñaba el
 * provisional; aquí se ocultaba.
 */
function ItemAmount({ item }: { item: HubItem }) {
  if (item.readyForExport) return <>{formatReceiptAmountEur(item.grandTotal)}</>;
  if (item.provisionalTotal > 0) {
    return (
      <span className="font-normal text-muted-foreground">
        {formatReceiptAmountEur(item.provisionalTotal)}
        <span className="ml-1 text-2xs">prov.</span>
      </span>
    );
  }
  return <>—</>;
}

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
        title="Compensación de jueces"
        description="Acceso directo a facturación y recibos por campeonato, sin ir tarima a tarima."
      >
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
      </PageHeader>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive-border bg-destructive-muted px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <MetricStrip columns={4}>
        {/* Rótulos cortos: en móvil la celda mide ~170 px y «Campeonatos con
            jueces» o «Jueces con km pendientes» salían cortados. */}
        <MetricTile label="Campeonatos" value={items.length} hint="Con jueces en tarima" />
        <MetricTile
          label="Confirmado"
          value={formatReceiptAmountEur(confirmedTotal)}
          tone={pendingAmount > 0 ? "warning" : "neutral"}
          hint={pendingAmount > 0 ? `+ ${formatReceiptAmountEur(pendingAmount)} pendiente de km` : undefined}
        />
        <MetricTile label="Listos para exportar" value={readyCount} />
        <MetricTile
          label="Jueces sin km"
          value={totalPendingKm}
          tone={totalPendingKm > 0 ? "warning" : "neutral"}
        />
      </MetricStrip>

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
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Móvil: filas enlazadas. La tabla de siete columnas obligaba a
              desplazarse en horizontal y el botón «Abrir» quedaba fuera. */}
          <ul className="divide-y divide-border-muted md:hidden">
            {items.map((item) => (
              <li key={item.competitionId}>
                <Link
                  href={`/competitions/${item.competitionId}/compensation`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.nombre}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatDateRange(item.fecha, item.fechaFin)} · {contar(item.judgeCount, "juez", "jueces")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <EventStatusBadge status={item.estado} />
                      <ExportChip item={item} />
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                    <ItemAmount item={item} />
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <DataTable className="hidden md:table">
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
                      <ExportChip item={item} />
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-right text-sm font-medium">
                    <ItemAmount item={item} />
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
