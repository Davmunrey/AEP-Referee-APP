"use client";

import Link from "next/link";
import type { Competition } from "@/lib/types";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/competitions/roster-header-actions";
import dynamic from "next/dynamic";
// El historial es un desplegable que se abre a demanda.
const RosterHistoryPanel = dynamic(
  () => import("@/components/competitions/roster-history-panel").then((m) => m.RosterHistoryPanel),
  { ssr: false, loading: () => <span className="inline-block h-8 w-[92px]" aria-hidden="true" /> },
);
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
  submitBlockedReason?: string | null;
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
  submitBlockedReason = null,
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
    <div className="border-b border-border-muted px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
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
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border"
                  title="Campeonato finalizado — editable con permisos para cargar histórico"
                >
                  Histórico
                </span>
              )}
              <span className="text-xs text-subtle-muted">{competition.aprobacion}</span>
            </div>
            <div className="flex items-center gap-1">
              <h1 className="truncate text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {competition.nombre}
              </h1>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenEdit}
                  title="Editar campeonato"
                  aria-label="Editar campeonato"
                  className="ml-1 h-7 w-7 shrink-0"
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

        {/* Móvil: a lo ancho y de izquierda a derecha. Alineadas a la derecha,
            siete acciones caían en filas irregulares pegadas al borde. */}
        <div className="flex w-full min-w-0 flex-col items-start gap-1.5 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {/* El aviso va en la misma fila que las acciones: antes flotaba
                encima, en una línea propia. */}
            {violationCount > 0 && (
              <p
                className="flex h-8 items-center gap-1.5 rounded-lg bg-warning-muted px-2.5 text-xs font-medium text-warning"
                title="Hay jueces asignados por debajo del nivel mínimo del puesto"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {violationCount} {violationCount > 1 ? "avisos" : "aviso"} de normativa
              </p>
            )}
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
                submitBlockedReason={submitBlockedReason}
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
