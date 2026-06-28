"use client";

import type { Referee, Zone } from "@/lib/types";
import { LevelBadge } from "@/components/aep/badges";
import { topArbitrajeRoles } from "@/lib/judges-registry/arbitraje-stats";
import { GripVertical, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { zoneName } from "./roster-session-helpers";

export function RefereeCard({
  zones,
  referee,
  assigned,
  dragging,
  blockedReason,
  warningReason,
  competitionZona,
  onDragStart,
  onDragEnd,
  onClick,
  highlight,
  isDragging,
  readOnly = false,
  isConfirmed = false,
}: {
  zones: Zone[];
  referee: Referee;
  assigned: boolean;
  dragging: boolean;
  blockedReason?: string | null;
  warningReason?: string | null;
  competitionZona?: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  highlight: boolean;
  isDragging: boolean;
  readOnly?: boolean;
  isConfirmed?: boolean;
}) {
  const locked = readOnly || !!blockedReason;
  const topRoles = referee.arbitrajeStats
    ? topArbitrajeRoles(referee.arbitrajeStats, 2)
    : [];
  const isFromOtherZone = !!competitionZona && referee.zona !== competitionZona;
  const zoneLabel = zoneName(zones, referee.zona);
  const alertText = blockedReason ?? warningReason ?? (referee.eventos >= 8 ? `Alta carga (${referee.eventos})` : null);

  return (
    <li
      draggable={!locked}
      title={alertText ?? undefined}
      onDragStart={(e) => {
        if (locked) return;
        e.dataTransfer.setData("text/plain", referee.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => !locked && onClick()}
      className={cn(
        "flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface/80 px-2 py-1 transition-all duration-100 active:cursor-grabbing",
        assigned && "opacity-55",
        locked && "cursor-default",
        dragging && "scale-[0.98] opacity-40",
        !locked && highlight && "cursor-pointer border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10",
        !locked && isDragging && !dragging && "hover:border-success/50 hover:bg-success/5",
        !locked && !highlight && !isDragging && "hover:border-border-strong hover:bg-surface",
        alertText && !blockedReason && referee.eventos >= 8 && "border-amber-400/30",
        blockedReason && "border-warning-border/60 bg-warning-subtle/40",
      )}
    >
      <GripVertical
        className={cn(
          "h-3 w-3 shrink-0",
          highlight ? "text-primary" : "text-subtle-muted/80",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight text-foreground">
            {referee.nombre}
          </p>
          {assigned ? (
            <Check className="h-3 w-3 shrink-0 text-success" aria-label="Asignado en esta sesión" />
          ) : isConfirmed ? (
            <span className="shrink-0 text-[9px] font-bold text-success" title="Disponibilidad confirmada">
              ✓
            </span>
          ) : null}
        </div>
        <p className="truncate text-[10px] leading-tight text-subtle-muted">
          <span className={cn(isFromOtherZone && "font-medium text-orange-500")}>
            {isFromOtherZone ? `⟳ ${zoneLabel}` : zoneLabel}
          </span>
          <span className="mx-1 text-border">·</span>
          <span className="font-mono">
            {referee.eventos} arb.
            {topRoles.length > 0 &&
              ` · ${topRoles.map((r) => `${r.count}×${r.role.split(" ")[0]}`).join(" ")}`}
          </span>
        </p>
      </div>
      <LevelBadge level={referee.nivel} compact />
    </li>
  );
}
