"use client";

import Link from "next/link";
import type { Competition } from "@/lib/types";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/competitions/roster-header-actions";
import { RosterHistoryPanel } from "@/components/competitions/roster-history-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ArrowLeft, Banknote, ChevronDown, FileUp, Layers, Pencil, Trash2, UsersRound } from "lucide-react";
import type { TransitionStartFunction } from "react";

interface RosterCompetitionHeaderProps {
  competition: Competition;
  isPast: boolean;
  canEdit: boolean;
  canManageCompensation?: boolean;
  rosterLocked?: boolean;
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
  canManageCompensation = false,
  rosterLocked = false,
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit && isEditing && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={onToggleEditing}
                disabled={pending || savingTemplate}
              >
                Volver a tarima
              </Button>
            )}
            {canEdit && !isEditing && !rosterLocked && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    disabled={pending || savingTemplate}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Plantilla
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={onOpenImport}>
                    <FileUp className="mr-2 h-3.5 w-3.5" />
                    Importar horario
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenQuadrant} disabled={templateLength === 0}>
                    <UsersRound className="mr-2 h-3.5 w-3.5" />
                    Importar cuadrante
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onToggleEditing}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar plantilla
                  </DropdownMenuItem>
                  {(filledSlots > 0 || templateLength > 0) && <DropdownMenuSeparator />}
                  {filledSlots > 0 && (
                    <DropdownMenuItem
                      onSelect={clearAllAssignments}
                      className="text-warning focus:text-warning"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Vaciar jueces
                    </DropdownMenuItem>
                  )}
                  {templateLength > 0 && (
                    <DropdownMenuItem
                      onSelect={clearTemplateAndAssignments}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Borrar plantilla
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canManageCompensation && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" asChild>
                <Link href={`/competitions/${competition.id}/compensation`}>
                  <Banknote className="h-3.5 w-3.5" />
                  Compensación
                </Link>
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
                rosterLocked={rosterLocked}
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
