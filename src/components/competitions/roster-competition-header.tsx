"use client";

import Link from "next/link";
import type { Competition } from "@/lib/types";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { RosterHeaderActions, RosterMoreMenu } from "@/components/competitions/roster-header-actions";
import { useState } from "react";
import dynamic from "next/dynamic";
// El historial es un desplegable que se abre a demanda.
const RosterHistoryPanel = dynamic(
  () => import("@/components/competitions/roster-history-panel").then((m) => m.RosterHistoryPanel),
  { ssr: false, loading: () => <span className="hidden h-8 w-[92px] md:inline-block" aria-hidden="true" /> },
);
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ArrowLeft, Banknote, ChevronDown, FileUp, History, Layers, Megaphone, Pencil, Trash2, UsersRound } from "lucide-react";
import { cn, formatDate, formatDateRange } from "@/lib/utils";
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
  /** Resumen de la convocatoria del campeonato (`null` si no hay). */
  convocatoria?: { abierta: boolean; inscritos: number } | null;
  /** Abre la convocatoria; sin él (sin permiso, sin plantilla) no hay botón. */
  onOpenConvocatoria?: () => void;
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
  convocatoria = null,
  onOpenConvocatoria,
  onOpenImport,
  onOpenQuadrant,
  clearAllAssignments,
  clearTemplateAndAssignments,
  onStatus,
  startTransition,
  onToggleEditing,
}: RosterCompetitionHeaderProps) {
  const readOnly = !canEdit;
  const [historyOpen, setHistoryOpen] = useState(false);
  const showTemplateMenu = canEdit && !isEditing && !rosterLocked;
  const showConvocatoria = Boolean(onOpenConvocatoria) && !isEditing;
  const showActions = !readOnly && !isEditing;
  const fechaFin = competition.fechaFin ?? competition.fecha;
  const convocatoriaTitle = convocatoria
    ? `${convocatoria.abierta ? "Convocatoria abierta" : "Convocatoria cerrada"} · ${convocatoria.inscritos} inscritos`
    : "Lanzar la convocatoria para que los jueces se apunten";

  // Lo mismo que la barra de escritorio, en el menú «Más» de móvil. Los
  // elementos de la plantilla van planos bajo un rótulo: un submenú dentro de
  // un menú se maneja mal con el dedo.
  const moreItems = (
    <>
      {showTemplateMenu && (
        <>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Plantilla</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onOpenImport} disabled={pending || savingTemplate}>
            <FileUp className="mr-2 h-3.5 w-3.5" />
            Importar horario
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenQuadrant} disabled={templateLength === 0 || pending || savingTemplate}>
            <UsersRound className="mr-2 h-3.5 w-3.5" />
            Importar cuadrante
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleEditing} disabled={pending || savingTemplate}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar plantilla
          </DropdownMenuItem>
          {filledSlots > 0 && (
            <DropdownMenuItem onSelect={clearAllAssignments} className="text-warning focus:text-warning">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Vaciar jueces
            </DropdownMenuItem>
          )}
          {templateLength > 0 && (
            <DropdownMenuItem onSelect={clearTemplateAndAssignments} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Borrar plantilla
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
        </>
      )}
      {showConvocatoria && (
        <DropdownMenuItem onSelect={onOpenConvocatoria} title={convocatoriaTitle}>
          <Megaphone className="mr-2 h-3.5 w-3.5" />
          {convocatoria ? "Convocatoria" : "Convocar"}
          {convocatoria && (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {convocatoria.inscritos} inscritos
            </span>
          )}
        </DropdownMenuItem>
      )}
      {canManageCompensation && (
        <DropdownMenuItem asChild>
          <Link href={`/competitions/${competition.id}/compensation`}>
            <Banknote className="mr-2 h-3.5 w-3.5" />
            Compensación
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
        <History className="mr-2 h-3.5 w-3.5" />
        Historial
      </DropdownMenuItem>
    </>
  );

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
              {fechaFin === competition.fecha
                ? formatDate(competition.fecha)
                : formatDateRange(competition.fecha, fechaFin)}{" "}
              · {competition.sede}
            </p>
          </div>
        </div>

        {/* Móvil: a lo ancho, con el estado (avisos, cobertura) y el envío a la
            vista y lo demás en «Más». Desde `md`, la barra completa. */}
        <div className="flex w-full min-w-0 flex-col items-start gap-1.5 md:w-auto md:items-end">
          <div className="flex w-full flex-wrap items-center justify-start gap-2 md:w-auto md:justify-end">
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
            {/* Acciones secundarias: solo en escritorio (en móvil, en «Más»). */}
            <span className="hidden md:contents">
            {showTemplateMenu && (
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
            {showConvocatoria && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={onOpenConvocatoria}
                title={convocatoriaTitle}
              >
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                {convocatoria ? "Convocatoria" : "Convocar"}
                {convocatoria && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      convocatoria.abierta ? "bg-info-muted text-info" : "bg-surface-active text-muted-foreground",
                    )}
                  >
                    {convocatoria.inscritos}
                  </span>
                )}
              </Button>
            )}
            {canManageCompensation && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" asChild>
                <Link href={`/competitions/${competition.id}/compensation`}>
                  <Banknote className="h-3.5 w-3.5" />
                  Compensación
                </Link>
              </Button>
            )}
            </span>
            {/* Fuera del bloque de escritorio: en móvil se abre desde «Más». */}
            <RosterHistoryPanel
              competitionId={competition.id}
              open={historyOpen}
              onOpenChange={setHistoryOpen}
              className="max-md:contents"
              triggerClassName="max-md:hidden"
            />
            {!showActions && !isEditing && <RosterMoreMenu>{moreItems}</RosterMoreMenu>}
            {showActions && (
              <RosterHeaderActions
                moreItems={moreItems}
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
