"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EventStatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { api } from "@/lib/api/client";
import { textareaFieldClass } from "@/lib/design-tokens";
import type { ApprovalProposal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

interface ApprovalsBoardProps {
  initial: ApprovalProposal[];
  canReview: boolean;
}

export function ApprovalsBoard({ initial, canReview }: ApprovalsBoardProps) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<ApprovalProposal | null>(
    initial.find((a) => a.status === "pendiente") ?? initial[0] ?? null,
  );
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const pendingCount = items.filter((a) => a.status === "pendiente").length;

  const review = (approve: boolean) => {
    if (!selected || !canReview) return;
    startTransition(async () => {
      try {
        const updated = await api.reviewApproval(selected.id, approve, comment || undefined);
        setItems((prev) => {
          const next = prev.map((a) => (a.id === updated.id ? updated : a));
          const nextPending = next.find((a) => a.status === "pendiente");
          setSelected(nextPending ?? null);
          return next;
        });
        setComment("");
        router.refresh();
      } catch {
        /* ignore */
      }
    });
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión"
        title="Aprobaciones"
        description={`${pendingCount} propuestas pendientes de revisión nacional · diff de roster y decisión centralizada`}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border-muted pb-4">
            <CardTitle>Cola de propuestas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin propuestas"
                description="No hay envíos pendientes en este momento."
              />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={cn(
                    "w-full rounded-xl border p-3.5 text-left transition-all",
                    selected?.id === item.id
                      ? "border-primary-border bg-primary-muted shadow-glow-primary"
                      : "border-border hover:border-border-strong hover:bg-surface-hover",
                  )}
                >
                  <p className="font-medium text-foreground">{item.eventName}</p>
                  <p className="mt-0.5 text-xs text-subtle-muted">
                    {item.zona} · {item.submittedBy}
                  </p>
                  <StatusPill status={item.status} className="mt-2" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel-soft lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted pb-4">
            <CardTitle>Detalle y diff de roster</CardTitle>
            {selected && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/events/${selected.eventId}`}>Abrir tarima</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!selected ? (
              <EmptyState
                title="Selecciona una propuesta"
                description="Elige un envío en la cola para ver el diff y actuar."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status="Incompleto" />
                  <span className="font-mono text-xs text-subtle-muted">{selected.submittedAt}</span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-background/80 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                  {Object.entries(selected.assignments).map(([slot, ref]) => (
                    <p key={slot} className="border-b border-border-muted/60 py-1.5 last:border-0">
                      <span className="text-subtle-muted">{slot}</span>
                      <span className="text-foreground-secondary"> → {ref}</span>
                    </p>
                  ))}
                </div>
                {canReview && selected.status === "pendiente" && (
                  <>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Comentario opcional al rechazar…"
                      className={textareaFieldClass}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={pending} onClick={() => review(false)}>
                        Rechazar
                      </Button>
                      <Button disabled={pending} onClick={() => review(true)}>
                        Aprobar propuesta
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
