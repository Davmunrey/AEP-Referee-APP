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
  return (
    <li
      draggable={!locked}
      onDragStart={(e) => {
        if (locked) return;
        e.dataTransfer.setData("text/plain", referee.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => !locked && onClick()}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 transition-all duration-100 active:cursor-grabbing",
        assigned && "opacity-60",
        locked && "cursor-default",
        dragging && "scale-95 opacity-40 shadow-none",
        !locked && highlight && "cursor-pointer border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10 hover:shadow-sm",
        !locked && isDragging && !dragging && "hover:border-success/50 hover:bg-success/5",
        !locked && !highlight && !isDragging && "hover:border-border-strong hover:bg-surface hover:shadow-sm",
      )}
    >
      <GripVertical
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          highlight ? "text-primary" : "text-subtle-muted",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-foreground">
            {referee.nombre}
          </p>
          {isConfirmed && (
            <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">✓</span>
          )}
        </div>
        <p className={cn("text-[11px]", isFromOtherZone ? "font-semibold text-orange-500" : "text-subtle-muted")}>
          {isFromOtherZone ? `⟳ ${zoneName(zones, referee.zona)}` : zoneName(zones, referee.zona)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-subtle-muted">
          {referee.eventos} arb.
          {topRoles.length > 0 &&
            ` · ${topRoles.map((r) => `${r.count}× ${r.role}`).join(", ")}`}
        </p>
        {blockedReason && (
          <p className="mt-1 text-[10px] font-medium text-warning">{blockedReason}</p>
        )}
        {warningReason && !blockedReason && (
          <p className="mt-1 text-[10px] font-medium text-warning">{warningReason}</p>
        )}
        {referee.eventos >= 8 && !blockedReason && (
          <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            ↑ alta carga ({referee.eventos} arb.)
          </p>
        )}
      </div>
      <LevelBadge level={referee.nivel} />
      {assigned && <Check className="h-3.5 w-3.5 shrink-0 text-success" />}
    </li>
  );
}
