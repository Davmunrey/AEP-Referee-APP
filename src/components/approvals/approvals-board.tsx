"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { api } from "@/lib/api/client";
import { textareaFieldClass } from "@/lib/design-tokens";
import { parseSlotKey, ROLE_LABELS } from "@/lib/roster-template";
import { selectedApproval } from "@/lib/approvals/select";
import type { ApprovalProposal, Competition } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutList,
  XCircle,
} from "lucide-react";
import { contar } from "@/lib/plural";
import { MetricTile } from "@/components/ui/metric-tile";

const PAGE_SIZE = 10;

interface ApprovalsBoardProps {
  initial: ApprovalProposal[];
  canReview: boolean;
  refNames?: Record<string, string>;
  competitions?: Competition[];
}


/**
 * Decode a raw slotKey like "S1_central_0" into a human-readable label.
 * Format: <sesion> · <role label> [· #<n>] (index shown only when > 0 or multiple slots exist)
 */
function decodeSlotKey(slotKey: string, allSlotKeys: string[]): string {
  const parsed = parseSlotKey(slotKey);
  if (!parsed) return slotKey;
  const { session: sesion, roleKey, index: idx } = parsed;

  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey;

  // Count how many slots share the same sesion+roleKey prefix
  const prefix = `${sesion}_${roleKey}_`;
  const siblings = allSlotKeys.filter((k) => k.startsWith(prefix));
  const showIndex = idx > 0 || siblings.length > 1;

  return showIndex ? `${sesion} · ${roleLabel} · #${idx + 1}` : `${sesion} · ${roleLabel}`;
}

export function ApprovalsBoard({
  initial,
  canReview,
  refNames = {},
  competitions = [],
}: ApprovalsBoardProps) {
  const [items, setItems] = useState(initial);
  // Se guarda el id, no la propuesta: al refrescar desde el servidor el objeto
  // capturado quedaba obsoleto y el panel de detalle seguía mostrando el estado
  // y el comentario anteriores (o una propuesta que ya no está en la lista)
  // mientras la columna de la izquierda ya se había actualizado.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const router = useRouter();

  // Re-sincroniza con los datos del servidor tras router.refresh() (mismo
  // patrón que competitions-table / referees-directory).
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const selected = selectedApproval(items, selectedId);

  const pendingCount = items.filter((a) => a.status === "pendiente").length;
  const approvedCount = items.filter((a) => a.status === "aprobado").length;
  const rejectedCount = items.filter((a) => a.status === "rechazado").length;
  const thisWeekCount = items.filter((a) => {
    try {
      return new Date(a.submittedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }).length;

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const review = (approve: boolean) => {
    if (!selected || !canReview) return;
    if (!approve && !comment.trim()) {
      setReviewError("El rechazo requiere un comentario explicativo.");
      return;
    }
    setReviewError(null);
    startTransition(async () => {
      try {
        const updated = await api.reviewApproval(selected.id, approve, comment || undefined);
        const next = items.map((a) => (a.id === updated.id ? updated : a));
        setItems(next);
        setSelectedId(next.find((a) => a.status === "pendiente")?.id ?? null);
        setComment("");
        router.refresh();
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Error al revisar la propuesta");
      }
    });
  };

  const allSlotKeys = selected ? Object.keys(selected.assignments) : [];
  const assignments = selected ? Object.entries(selected.assignments) : [];

  // Resolve real competition status from competitions list
  const eventStatus =
    selected && competitions.length > 0
      ? (competitions.find((c) => c.id === selected.competitionId)?.estado ?? "Incompleto")
      : "Incompleto";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Competiciones"
        title="Aprobaciones"
        description={`${contar(pendingCount, "propuesta pendiente", "propuestas pendientes")} de revisión nacional`}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Pendientes" value={pendingCount} tone="warning" icon={Clock} />
        <MetricTile label="Esta semana" value={thisWeekCount} tone="neutral" icon={LayoutList} />
        <MetricTile label="Aprobadas" value={approvedCount} tone="success" icon={CheckCircle2} />
        <MetricTile label="Rechazadas" value={rejectedCount} tone="danger" icon={XCircle} />
      </div>

      {/* Dual-column layout */}
      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        {/* Left: proposals list */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="border-b border-border-muted pb-3">
            <CardTitle className="text-sm">Cola de propuestas</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] flex-1 space-y-1.5 overflow-y-auto p-2">
            {items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin propuestas"
                description="No hay envíos pendientes en este momento."
              />
            ) : (
              <>
                {pagedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-pressed={selected?.id === item.id}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-(--ease-out) active:scale-[0.99] focus-ring",
                      selected?.id === item.id
                        ? "border-primary-border bg-primary-muted shadow-glow-primary"
                        : "border-border hover:border-border-strong hover:bg-surface-hover",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight text-foreground">{item.competitionName}</p>
                      <StatusPill status={item.status} className="shrink-0" />
                    </div>
                    <p className="mt-1 text-xs text-subtle-muted">
                      {item.zona} · {item.submittedBy}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-subtle-muted">
                      {item.submittedAt.slice(0, 10)}
                    </p>
                  </button>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-1 pt-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Página anterior"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-ring",
                        page === 0
                          ? "cursor-not-allowed border-border text-muted-foreground opacity-40"
                          : "border-border hover:border-border-strong hover:bg-surface-hover",
                      )}
                    >
                      <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                      Prev
                    </button>
                    <span className="text-[11px] text-subtle-muted">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      aria-label="Página siguiente"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-ring",
                        page >= totalPages - 1
                          ? "cursor-not-allowed border-border text-muted-foreground opacity-40"
                          : "border-border hover:border-border-strong hover:bg-surface-hover",
                      )}
                    >
                      Sig
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: detail + diff + action bar */}
        <Card
          className="glass-panel-soft flex flex-col lg:col-span-3"
          style={{ minHeight: "460px" }}
        >
          <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted pb-3">
            <CardTitle className="text-sm">Detalle de la propuesta</CardTitle>
            {selected && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/competitions/${selected.competitionId}`}>Abrir tarima</Link>
              </Button>
            )}
          </CardHeader>

          {!selected ? (
            <CardContent className="flex flex-1 items-center justify-center pt-6">
              <EmptyState
                title="Selecciona una propuesta"
                description="Elige una propuesta de la cola para ver su tarima y decidir."
              />
            </CardContent>
          ) : (
            <>
              <CardContent className="flex-1 space-y-4 overflow-y-auto pt-4">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status={eventStatus} />
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-subtle-muted">
                    {selected.submittedAt.slice(0, 10)}
                  </span>
                  <span className="text-xs text-muted-foreground">por {selected.submittedBy}</span>
                </div>

                {/* Diff table: slot → juez */}
                <div className="overflow-hidden rounded-xl border border-border bg-background/80">
                  <div className="border-b border-border-muted bg-muted/50 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle-muted">
                      Hueco → Juez
                    </span>
                  </div>
                  <div className="max-h-[260px] divide-y divide-border-muted/60 overflow-y-auto font-mono text-xs">
                    {assignments.length === 0 ? (
                      <p className="px-4 py-3 text-muted-foreground">
                        Sin asignaciones registradas.
                      </p>
                    ) : (
                      assignments.map(([slot, refId]) => (
                        <div
                          key={slot}
                          className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-muted/30"
                        >
                          <span className="w-48 shrink-0 truncate text-subtle-muted">
                            {decodeSlotKey(slot, allSlotKeys)}
                          </span>
                          <ArrowRight
                            className="h-3 w-3 shrink-0 text-border-strong"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-foreground-secondary">
                            {refNames[refId] ?? refId}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Resolution banner (when not pending) */}
                {selected.status !== "pendiente" && (
                  <div
                    className={cn(
                      "rounded-xl border p-3.5 text-sm",
                      selected.status === "aprobado"
                        ? "border-success-border bg-success-muted text-success"
                        : "border-destructive-border bg-destructive-muted text-destructive",
                    )}
                  >
                    <p className="font-semibold capitalize">{selected.status}</p>
                    {selected.comment && (
                      <p className="mt-1 text-xs opacity-80">{selected.comment}</p>
                    )}
                    {selected.reviewedBy && (
                      <p className="mt-1 text-[11px] opacity-80">
                        por {selected.reviewedBy}
                        {selected.reviewedAt ? ` · ${selected.reviewedAt.slice(0, 10)}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>

              {/* Sticky action bar */}
              {canReview && selected.status === "pendiente" && (
                <div className="rounded-b-xl border-t border-border bg-card/95 p-4 backdrop-blur-sm">
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      setReviewError(null);
                    }}
                    placeholder="Comentario (obligatorio al rechazar)…"
                    aria-label="Comentario de revisión (obligatorio al rechazar)"
                    className={textareaFieldClass}
                    rows={2}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => review(false)}
                      className="flex-1 sm:flex-none"
                    >
                      Rechazar
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => review(true)}
                      className="flex-1 sm:flex-none"
                    >
                      {pending ? "Procesando…" : "Aprobar propuesta"}
                    </Button>
                  </div>
                  {reviewError && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive">
                      {reviewError}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
