"use client";

import Link from "next/link";
import type { Competition } from "@/lib/types";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/competitions/roster-header-actions";
import { RosterHistoryPanel } from "@/components/competitions/roster-history-panel";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, FileUp, Pencil, Trash2, UsersRound } from "lucide-react";
import type { TransitionStartFunction } from "react";

interface RosterCompetitionHeaderProps {
  competition: Competition;
  isPast: boolean;
  canEdit: boolean;
  violationCount: number;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  openSlots: number;
  pending: boolean;
  savingTemplate: boolean;
  isEditing: boolean;
  statusMsg: string | null;
  statusIsError: boolean;
  templateLength: number;
  onOpenEdit: () => void;
  onOpenImport: () => void;
  onOpenQuadrant: () => void;
  clearAllAssignments: () => void;
  clearTemplateAndAssignments: () => void;
  onStatus: (msg: string | null, isError?: boolean) => void;
  startTransition: TransitionStartFunction;
  onToggleEditing: () => void;
}

export function RosterCompetitionHeader({
  competition,
  isPast,
  canEdit,
  violationCount,
  filledSlots,
  totalSlots,
  fillPct,
  openSlots,
  pending,
  savingTemplate,
  isEditing,
  statusMsg,
  statusIsError,
  templateLength,
  onOpenEdit,
  onOpenImport,
  onOpenQuadrant,
  clearAllAssignments,
  clearTemplateAndAssignments,
  onStatus,
  startTransition,
  onToggleEditing,
}: RosterCompetitionHeaderProps) {
  const readOnly = !canEdit;

  return (
    <div className="glass-panel-soft border-b border-border-muted px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
            <Link href="/competitions" aria-label="Volver a campeonatos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <EventTypeBadge tipo={competition.tipo} />
              <EventStatusBadge status={competition.estado} />
              {isPast && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  title="Campeonato finalizado — editable con permisos para cargar histórico"
                >
                  Histórico
                </span>
              )}
              <span className="text-xs text-subtle-muted">{competition.aprobacion}</span>
            </div>
            <div className="flex items-center gap-1">
              <h1 className="truncate text-lg font-semibold leading-tight text-foreground">
                {competition.nombre}
              </h1>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenEdit}
                  title="Editar campeonato"
                  className="ml-1 h-6 w-6 shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {competition.fecha} → {competition.fechaFin} · {competition.sede}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1.5">
          {violationCount > 0 && (
            <p className="flex items-center gap-1.5 rounded-md border border-warning-border bg-warning-subtle px-2.5 py-1 text-[11px] font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {violationCount} violación{violationCount > 1 ? "es" : ""} de normativa
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={onOpenImport}
                disabled={pending || savingTemplate}
                title="Importar horario de este campeonato (PDF)"
              >
                <FileUp className="h-3.5 w-3.5" />
                Importar horario
              </Button>
            )}
            {canEdit && filledSlots > 0 && !isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-warning-border px-2.5 text-xs text-warning hover:bg-warning-subtle"
                onClick={clearAllAssignments}
                disabled={pending || savingTemplate}
                title="Vaciar todas las asignaciones sin borrar la plantilla"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vaciar jueces
              </Button>
            )}
            {canEdit && templateLength > 0 && !isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={clearTemplateAndAssignments}
                disabled={pending || savingTemplate}
                title="Borrar plantilla, sesiones y asignaciones"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Borrar plantilla
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={onOpenQuadrant}
                disabled={pending || savingTemplate || templateLength === 0}
                title="Importar cuadrante de jueces (PDF)"
              >
                <UsersRound className="h-3.5 w-3.5" />
                Importar cuadrante
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant={isEditing ? "default" : "outline"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={onToggleEditing}
                disabled={pending || savingTemplate}
              >
                {isEditing ? "Volver a tarima" : "Editar plantilla"}
              </Button>
            )}
            <RosterHistoryPanel competitionId={competition.id} />
            {!readOnly && !isEditing && (
              <RosterHeaderActions
                competitionId={competition.id}
                filledSlots={filledSlots}
                totalSlots={totalSlots}
                fillPct={fillPct}
                violationCount={violationCount}
                openSlots={openSlots}
                pending={pending}
                statusMsg={statusMsg}
                statusIsError={statusIsError}
                onStatus={onStatus}
                startTransition={startTransition}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
