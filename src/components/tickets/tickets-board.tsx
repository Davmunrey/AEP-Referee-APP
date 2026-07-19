"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { SessionUser, SupportTicket, TicketCategory, TicketStatus } from "@/lib/types";
import {
  AttachmentThumb,
  CATEGORY_LABELS,
  CategoryBadge,
  relativeDate,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TicketStatusPill,
} from "@/components/tickets/ticket-shared";

const NewTicketDialog = dynamic(
  () => import("@/components/tickets/new-ticket-dialog").then((m) => m.NewTicketDialog),
  { ssr: false },
);

type StatusFilter = "todos" | TicketStatus;
type CategoryFilter = "todos" | TicketCategory;

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TicketsBoard({
  initialTickets,
  currentUser,
}: {
  initialTickets: SupportTicket[];
  currentUser: SessionUser;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Re-sincroniza con el servidor tras router.refresh() (patrón competitions-table).
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (statusFilter === "todos" || t.status === statusFilter) &&
          (categoryFilter === "todos" || t.categoria === categoryFilter),
      ),
    [tickets, statusFilter, categoryFilter],
  );

  const openCount = tickets.filter(
    (t) => t.status === "abierto" || t.status === "en_progreso",
  ).length;

  const isAdmin =
    currentUser.role === "super_admin" || currentUser.role === "delegado_jueces";
  const scopeNote = isAdmin
    ? "Vista de administración: todos los tickets"
    : "Tus tickets de soporte";

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Soporte"
          title="Tickets de soporte"
          description={`${scopeNote} · ${tickets.length} en total · ${openCount} en curso`}
        />
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo ticket
        </Button>
      </div>

      {/* Filtros */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-subtle-muted">
            Estado
          </span>
          <Pill active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
            Todos
          </Pill>
          {TICKET_STATUSES.map((s) => (
            <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {STATUS_LABELS[s]}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-subtle-muted">
            Categoría
          </span>
          <Pill
            active={categoryFilter === "todos"}
            onClick={() => setCategoryFilter("todos")}
          >
            Todas
          </Pill>
          {TICKET_CATEGORIES.map((c) => (
            <Pill
              key={c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            >
              {CATEGORY_LABELS[c]}
            </Pill>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={tickets.length === 0 ? "Aún no hay tickets" : "Sin resultados"}
          description={
            tickets.length === 0
              ? "Crea el primer ticket para reportar una incidencia o proponer una mejora."
              : "Ningún ticket coincide con los filtros seleccionados."
          }
        >
          {tickets.length === 0 && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo ticket
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => {
            const photos = t.attachments.filter((a) => a.signedUrl);
            return (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-hover focus-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge categoria={t.categoria} />
                      <TicketStatusPill status={t.status} />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-foreground">
                      {t.titulo}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.createdByName} · {relativeDate(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
                    aria-label={`${t.commentCount} comentarios`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.commentCount}
                  </span>
                </div>

                {photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {photos.slice(0, 4).map((a) => (
                      <AttachmentThumb key={a.id} attachment={a} />
                    ))}
                    {photos.length > 4 && (
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[11px] font-medium text-muted-foreground">
                        +{photos.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {dialogOpen && <NewTicketDialog onClose={() => setDialogOpen(false)} />}
    </PageShell>
  );
}
