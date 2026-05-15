"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LevelBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { api } from "@/lib/api/client";
import type { PromotionRequest } from "@/lib/types";
import { TrendingUp } from "lucide-react";

export function PromotionsBoard({
  initial,
  canReview,
}: {
  initial: PromotionRequest[];
  canReview: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const review = (id: string, approve: boolean) => {
    startTransition(async () => {
      const updated = await api.reviewPromotion(id, approve);
      setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      router.refresh();
    });
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión"
        title="Ascensos de nivel"
        description="Solicitudes Regional → Nacional → IPF · revisión centralizada"
      />

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
    </PageShell>
  );
}
