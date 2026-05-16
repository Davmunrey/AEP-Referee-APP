"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LevelBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { NewPromotionDialog } from "@/components/promotions/new-promotion-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { api } from "@/lib/api/client";
import type { PromotionRequest, Referee, Zone } from "@/lib/types";
import { TrendingUp } from "lucide-react";

export function PromotionsBoard({
  initial,
  canReview,
  canCreate,
  referees,
  zones,
  userZona,
}: {
  initial: PromotionRequest[];
  canReview: boolean;
  canCreate: boolean;
  referees: Referee[];
  zones: Zone[];
  userZona?: string;
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [reviewError, setReviewError] = useState<string | null>(null);
  const router = useRouter();

  const review = (id: string, approve: boolean) => {
    setReviewError(null);
    startTransition(async () => {
      try {
        const updated = await api.reviewPromotion(id, approve);
        setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        router.refresh();
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Error al revisar");
      }
    });
  };

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Gestión"
          title="Ascensos de nivel"
          description="Solicitudes Regional → Nacional → IPF · revisión centralizada"
        />
        {canCreate && (
          <NewPromotionDialog referees={referees} zones={zones} userZona={userZona} />
        )}
      </div>

      <Card>
        <CardHeader className="border-b border-border-muted pb-4">
          <CardTitle>Solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              className="m-4 border-none bg-transparent"
              title="Sin solicitudes"
              description="No hay ascensos pendientes de revisión."
            />
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-surface-hover"
              >
                <div>
                  <p className="font-medium text-foreground">{p.refereeName}</p>
                  <p className="mt-0.5 text-xs text-subtle-muted">
                    {p.zona} · {p.eventosCompletados} eventos · {p.submittedAt}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <LevelBadge level={p.fromLevel} />
                    <span className="text-subtle-muted">→</span>
                    <LevelBadge level={p.toLevel} />
                  </div>
                  {p.motivo ? (
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                      {p.motivo}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={p.status} />
                  {canReview && p.status === "pendiente" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => review(p.id, false)}
                      >
                        Rechazar
                      </Button>
                      <Button size="sm" disabled={pending} onClick={() => review(p.id, true)}>
                        Aprobar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {reviewError && (
        <p className="text-sm text-destructive">{reviewError}</p>
      )}
    </PageShell>
  );
}
