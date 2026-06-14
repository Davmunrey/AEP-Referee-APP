"use client";

import { Dispatch, SetStateAction } from "react";
import type { AssignmentsMap, Competition, Referee, RefereeLevel, RegulationRule, RoleKey, RosterSession, Zone } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info, Users } from "lucide-react";
import { selectFieldClass } from "@/lib/design-tokens";
import { getAssignabilityReason, getOperationalBlockReason, getRecommendationWarning } from "@/lib/roster-ui";
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
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold text-foreground-secondary">Jueces disponibles</h2>
        {selectedSlot && !readOnly && (
          <p className="mt-0.5 text-xs font-medium text-primary">
            {selectedSlotMeta
              ? `${selectedSlotMeta.sessionLabel} · ${selectedSlotMeta.roleLabel} ${selectedSlotMeta.slotNumber}`
              : "Slot seleccionado"}{" "}
            — haz clic en un juez para asignar
          </p>
        )}
        {selectedSlot && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-[11px] text-primary">Selección activa para asignación rápida</span>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onSelectSlot(null)}>
              Cancelar selección
            </Button>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={onAvailabilityOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground-secondary transition-colors hover:bg-surface-hover"
            >
              <Users className="h-3 w-3" />
              Disponibilidad
              {confirmedIds.size > 0 && (
                <span className="rounded-full bg-success/20 px-1.5 text-[10px] font-semibold text-success">{confirmedIds.size}</span>
              )}
            </button>
          )}
          {confirmedIds.size > 0 && (
            <button
              type="button"
              onClick={() => onFilterConfirmed((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${filterOnlyConfirmed ? "border-success/40 bg-success/10 text-success" : "border-border text-subtle-muted hover:bg-surface-hover"}`}
            >
              Solo confirmados
            </button>
          )}
        </div>
        <div className="mt-2 grid gap-2">
          <Input placeholder="Buscar por nombre..." value={search} onChange={(e) => onSearch(e.target.value)} className="h-9" />
          <select value={filterZona} onChange={(e) => onFilterZona(e.target.value)} className={selectFieldClass} aria-label="Filtrar por zona">
            <option value="TODAS">Todas las zonas</option>
            {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
          </select>
          <select value={filterNivel} onChange={(e) => onFilterNivel(e.target.value)} className={selectFieldClass} aria-label="Filtrar por nivel">
            <option value="TODOS">Todos los niveles</option>
            {levels.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <p className="mt-2 font-mono text-[10px] text-subtle-muted">
          {referees.length} jueces{" · "}{referees.filter((r) => assignedIds.has(r.id)).length} ya en tarima
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="space-y-1.5 p-2.5">
          {referees.map((referee) => {
            const blockedReason =
              selectedRoleKey && selectedSlot
                ? getAssignabilityReason(referee, selectedRoleKey, competitionTipo, regulations) ??
                  getOperationalBlockReason({ template, assignments, slotKey: selectedSlot, refereeId: referee.id })
                : null;
            const warningReason =
              selectedRoleKey && !blockedReason
                ? getRecommendationWarning(referee, selectedRoleKey, competitionTipo, regulations)
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

      <div className="border-t border-border bg-background px-3 py-2">
        <p className="flex items-start gap-2 text-[10.5px] leading-snug text-subtle-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Arrastra un juez a un hueco, o haz clic en el hueco y luego en el juez.
        </p>
      </div>
    </section>
  );
}
