"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { LevelBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { api } from "@/lib/api/client";
import { textareaFieldClass } from "@/lib/design-tokens";
import type { PromotionRequest, Referee } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
const NewPromotionDialog = dynamic(
  () => import("@/components/promotions/new-promotion-dialog").then((m) => m.NewPromotionDialog),
  { ssr: false },
);
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  XCircle,
} from "lucide-react";

function StatCard({
  label,
  value,
  tone,
  iconBg,
  Icon,
}: {
  label: string;
  value: number | string;
  tone: string;
  iconBg: string;
  Icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 px-4 py-3.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", tone)} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-bold leading-none tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const GROUP_LABELS: Record<string, string> = {
  pendiente: "Pendientes de revisión",
  aprobado: "Aprobadas",
  rechazado: "Rechazadas",
};

const GROUP_ORDER = ["pendiente", "aprobado", "rechazado"] as const;

export function PromotionsBoard({
  initial,
  canReview,
  canCreate,
  referees,
}: {
  initial: PromotionRequest[];
  canReview: boolean;
  canCreate: boolean;
  referees: Referee[];
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  // Per-item review errors: key = promotion id
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [expandedMotivo, setExpandedMotivo] = useState<Set<string>>(new Set());
  // Track which item is being rejected (shows inline reject modal)
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const router = useRouter();

  // Re-sincroniza con los datos del servidor tras router.refresh() (mismo
  // patrón que competitions-table).
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const pendingCount = items.filter((p) => p.status === "pendiente").length;
  const approvedCount = items.filter((p) => p.status === "aprobado").length;
  const rejectedCount = items.filter((p) => p.status === "rechazado").length;
  const thisWeekCount = items.filter((p) => {
    try {
      return new Date(p.submittedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }).length;

  const clearItemError = (id: string) => {
    setReviewErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const approve = (id: string) => {
    clearItemError(id);
    startTransition(async () => {
      try {
        const updated = await api.reviewPromotion(id, true);
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        router.refresh();
      } catch (err) {
        setReviewErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : "Error al aprobar",
        }));
      }
    });
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectComment("");
    clearItemError(id);
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectComment("");
  };

  const confirmReject = (id: string) => {
    if (!rejectComment.trim()) {
      setReviewErrors((prev) => ({
        ...prev,
        [id]: "El rechazo requiere un motivo explicativo.",
      }));
      return;
    }
    clearItemError(id);
    startTransition(async () => {
      try {
        const updated = await api.reviewPromotion(id, false, rejectComment.trim());
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setRejectingId(null);
        setRejectComment("");
        router.refresh();
      } catch (err) {
        setReviewErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : "Error al rechazar",
        }));
      }
    });
  };

  const toggleMotivo = (id: string) => {
    setExpandedMotivo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = GROUP_ORDER.map((status) => ({
    status,
    label: GROUP_LABELS[status],
    items: items.filter((p) => p.status === status),
  }));

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Gestión"
          title="Ascensos de nivel"
          description={`${pendingCount} solicitudes pendientes · Regional → Nacional → IPF · revisión centralizada`}
        />
        {canCreate && (
          <NewPromotionDialog referees={referees} />
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pendientes"
          value={pendingCount}
          tone="text-warning"
          iconBg="bg-warning-muted"
          Icon={Clock}
        />
        <StatCard
          label="Esta semana"
          value={thisWeekCount}
          tone="text-foreground-secondary"
          iconBg="bg-muted"
          Icon={TrendingUp}
        />
        <StatCard
          label="Aprobadas"
          value={approvedCount}
          tone="text-success"
          iconBg="bg-success-muted"
          Icon={CheckCircle2}
        />
        <StatCard
          label="Rechazadas"
          value={rejectedCount}
          tone="text-destructive"
          iconBg="bg-destructive-muted"
          Icon={XCircle}
        />
      </div>

      {/* Grouped sections */}
      <div className="space-y-4">
        {grouped.map(({ status, label, items: groupItems }) => {
          if (groupItems.length === 0 && status !== "pendiente") return null;
          return (
            <Card key={status}>
              <CardHeader className="border-b border-border-muted pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                      status === "pendiente"
                        ? "bg-warning-muted text-warning"
                        : status === "aprobado"
                          ? "bg-success-muted text-success"
                          : "bg-destructive-muted text-destructive",
                    )}
                  >
                    {groupItems.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {groupItems.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    className="m-4 border-none bg-transparent"
                    title="Sin solicitudes"
                    description="No hay ascensos pendientes de revisión."
                  />
                ) : (
                  groupItems.map((p) => {
                    const motivoLong = (p.motivo?.length ?? 0) > 80;
                    const motivoExpanded = expandedMotivo.has(p.id);
                    const isRejecting = rejectingId === p.id;
                    const itemError = reviewErrors[p.id];

                    return (
                      <div key={p.id} className="transition-colors hover:bg-surface-hover">
                        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{p.refereeName}</p>
                            <p className="mt-0.5 text-xs text-subtle-muted">
                              {p.zona} · {p.eventosCompletados} arbitrajes ·{" "}
                              {p.submittedAt.slice(0, 10)}
                            </p>

                            {/* Level transition */}
                            <div className="mt-3 flex items-center gap-1.5">
                              <LevelBadge level={p.fromLevel} />
                              <ArrowRight
                                className="h-3 w-3 shrink-0 text-subtle-muted"
                                aria-hidden="true"
                              />
                              <LevelBadge level={p.toLevel} />
                            </div>

                            {p.reviewComment && p.status === "rechazado" ? (
                              <p className="mt-2 text-xs text-destructive">
                                Motivo del rechazo: {p.reviewComment}
                              </p>
                            ) : null}

                            {/* Expandable motivo */}
                            {p.motivo ? (
                              <div className="mt-2">
                                <p
                                  className={cn(
                                    "max-w-xl text-xs leading-relaxed text-muted-foreground",
                                    motivoLong && !motivoExpanded ? "line-clamp-2" : "",
                                  )}
                                >
                                  {p.motivo}
                                </p>
                                {motivoLong && (
                                  <button
                                    type="button"
                                    onClick={() => toggleMotivo(p.id)}
                                    className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                                  >
                                    {motivoExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3" aria-hidden="true" />
                                        Ver menos
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                        Ver más
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <StatusPill status={p.status} />
                            {canReview && p.status === "pendiente" && !isRejecting && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() => openReject(p.id)}
                                >
                                  Rechazar
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => approve(p.id)}
                                >
                                  Aprobar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline reject panel */}
                        {isRejecting && (
                          <div className="border-t border-border-muted bg-destructive-muted/30 px-6 py-4">
                            <p className="mb-2 text-xs font-semibold text-destructive">
                              Motivo del rechazo{" "}
                              <span className="font-normal text-subtle-muted">(obligatorio)</span>
                            </p>
                            <textarea
                              autoFocus
                              value={rejectComment}
                              onChange={(e) => {
                                setRejectComment(e.target.value);
                                clearItemError(p.id);
                              }}
                              placeholder="Explica el motivo del rechazo…"
                              className={textareaFieldClass}
                              rows={2}
                            />
                            {itemError && (
                              <p role="alert" className="mt-1 text-xs text-destructive">
                                {itemError}
                              </p>
                            )}
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelReject}
                                disabled={pending}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => confirmReject(p.id)}
                                disabled={pending}
                              >
                                {pending ? "Enviando…" : "Confirmar rechazo"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Per-item error outside reject panel (e.g. approve errors) */}
                        {itemError && !isRejecting && (
                          <p
                            role="alert"
                            className="px-6 pb-3 text-xs text-destructive"
                          >
                            {itemError}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
