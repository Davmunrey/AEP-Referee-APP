"use client";

import { Dispatch, SetStateAction } from "react";
import type { AssignmentsMap, Competition, FlagsMap, Referee, RefereeLevel, RegulationRule, RoleKey, RosterSession, Zone } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";
import { selectFieldClass } from "@/lib/design-tokens";
import { getAssignabilityReason, getOperationalBlock, getRecommendationWarning } from "@/lib/roster-ui";
import { RefereeCard } from "./roster-referee-card";

interface RosterRefereePanelProps {
  referees: Referee[];
  assignedIds: Set<string>;
  canEdit: boolean;
  readOnly: boolean;
  selectedSlot: string | null;
  selectedSlotMeta: { sessionLabel: string; roleLabel: string; slotNumber: number } | null;
  confirmedIds: Set<string>;
  filterOnlyConfirmed: boolean;
  filterZona: string;
  filterNivel: string;
  search: string;
  zones: Zone[];
  levels: RefereeLevel[];
  isDragging: boolean;
  draggedId: string | null;
  competitionTipo: Competition["tipo"];
  competitionZona?: string;
  regulations: RegulationRule[];
  template: RosterSession[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  selectedRoleKey?: RoleKey;
  onSelectSlot: (key: string | null) => void;
  onAvailabilityOpen: () => void;
  onFilterZona: Dispatch<SetStateAction<string>>;
  onFilterNivel: Dispatch<SetStateAction<string>>;
  onSearch: Dispatch<SetStateAction<string>>;
  onFilterConfirmed: Dispatch<SetStateAction<boolean>>;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onQuickAssign: (id: string) => void;
}

export function RosterRefereePanelLeft({
  referees,
  assignedIds,
  canEdit,
  readOnly,
  selectedSlot,
  selectedSlotMeta,
  confirmedIds,
  filterOnlyConfirmed,
  filterZona,
  filterNivel,
  search,
  zones,
  levels,
  isDragging,
  draggedId,
  competitionTipo,
  competitionZona,
  regulations,
  template,
  assignments,
  flags,
  selectedRoleKey,
  onSelectSlot,
  onAvailabilityOpen,
  onFilterZona,
  onFilterNivel,
  onSearch,
  onFilterConfirmed,
  onDragStart,
  onDragEnd,
  onQuickAssign,
}: RosterRefereePanelProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-r border-border">
      <div className="border-b border-border px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-foreground-secondary">Jueces</h2>
          <span className="font-mono text-[10px] text-subtle-muted">
            {referees.length} · {referees.filter((r) => assignedIds.has(r.id)).length} en sesión
          </span>
        </div>
        {selectedSlot && !readOnly && (
          <p className="mt-0.5 truncate text-[10px] font-medium text-primary">
            {selectedSlotMeta
              ? `${selectedSlotMeta.sessionLabel} · ${selectedSlotMeta.roleLabel} ${selectedSlotMeta.slotNumber}`
              : "Hueco seleccionado"}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={onAvailabilityOpen}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground-secondary hover:bg-surface-hover"
            >
              <Users className="h-3 w-3" />
              Disp.
              {confirmedIds.size > 0 && (
                <span className="rounded-full bg-success/20 px-1 text-[9px] font-semibold text-success">
                  {confirmedIds.size}
                </span>
              )}
            </button>
          )}
          {confirmedIds.size > 0 && (
            <button
              type="button"
              onClick={() => onFilterConfirmed((v) => !v)}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium ${filterOnlyConfirmed ? "border-success/40 bg-success/10 text-success" : "border-border text-subtle-muted hover:bg-surface-hover"}`}
            >
              Confirmados
            </button>
          )}
          {selectedSlot && !readOnly && (
            <button
              type="button"
              onClick={() => onSelectSlot(null)}
              className="rounded-md border border-primary/25 px-2 py-1 text-[10px] text-primary hover:bg-primary/5"
            >
              Cancelar hueco
            </button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="col-span-2 h-8 text-xs"
          />
          <select
            value={filterZona}
            onChange={(e) => onFilterZona(e.target.value)}
            className={`${selectFieldClass} h-8 text-xs`}
            aria-label="Filtrar por zona"
          >
            <option value="TODAS">Todas zonas</option>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={filterNivel}
            onChange={(e) => onFilterNivel(e.target.value)}
            className={`${selectFieldClass} h-8 text-xs`}
            aria-label="Filtrar por nivel"
          >
            <option value="TODOS">Todos niveles</option>
            {levels.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="space-y-0.5 p-1.5">
          {referees.map((referee) => {
            const opBlock =
              selectedRoleKey && selectedSlot
                ? getOperationalBlock({ template, assignments, slotKey: selectedSlot, refereeId: referee.id, flags })
                : null;
            // Bloqueo duro (nivel/normativa o conflicto no forzable) → no asignable.
            // Conflicto forzable (solape) → aviso, sigue siendo asignable (confirma al asignar).
            const blockedReason =
              selectedRoleKey && selectedSlot
                ? getAssignabilityReason(referee, selectedRoleKey, competitionTipo, regulations) ??
                  (opBlock && !opBlock.overridable ? opBlock.reason : null)
                : null;
            const warningReason =
              selectedRoleKey && !blockedReason
                ? opBlock?.overridable
                  ? opBlock.reason
                  : getRecommendationWarning(referee, selectedRoleKey, competitionTipo, regulations)
                : null;
            return (
              <RefereeCard
                key={referee.id}
                zones={zones}
                referee={referee}
                assigned={assignedIds.has(referee.id)}
                dragging={draggedId === referee.id}
                blockedReason={blockedReason}
                warningReason={warningReason}
                competitionZona={competitionZona}
                onDragStart={() => onDragStart(referee.id)}
                onDragEnd={onDragEnd}
                onClick={() => onQuickAssign(referee.id)}
                highlight={!!selectedSlot && !readOnly}
                isDragging={isDragging}
                readOnly={readOnly}
                isConfirmed={confirmedIds.has(referee.id)}
              />
            );
          })}
          {referees.length === 0 && (
            <li className="py-8 text-center text-xs text-subtle-muted">Sin coincidencias. Ajusta los filtros.</li>
          )}
        </ul>
      </div>

      <div className="hidden border-t border-border px-2 py-1 sm:block">
        <p className="truncate text-[9px] text-subtle-muted" title="Arrastra un juez a un hueco, o selecciona hueco y juez.">
          Arrastra o clic hueco → juez
        </p>
      </div>
    </section>
  );
}
