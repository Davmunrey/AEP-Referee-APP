"use client";

import Link from "next/link";
import { useState } from "react";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarDayEvent, EventStatus } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

/** June 2026 — week grid from prototype (includes May/Jul overflow). */
const CALENDAR_WEEKS: number[][] = [
  [25, 26, 27, 28, 29, 30, 31],
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 1, 2, 3, 4, 5],
];

function monthOf(weekIdx: number, dayIdx: number) {
  if (weekIdx === 0) return 5;
  if (weekIdx === 5 && dayIdx >= 2) return 7;
  return 6;
}

function dayKey(day: number, month: number) {
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const statusBar: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-primary",
  Borrador: "bg-subtle-muted",
};

export function OperationalCalendar({
  calendar,
}: {
  calendar: Record<string, CalendarDayEvent>;
}) {
  const [monthLabel] = useState("JUN 2026");

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-semibold">Calendario operativo</CardTitle>
          <span className="font-mono text-[11px] text-subtle-muted">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {(["Completo", "Incompleto", "Crítico", "Borrador"] as EventStatus[]).map((s) => (
            <EventStatusBadge key={s} status={s} />
          ))}
          <span className="mx-2 h-4 w-px bg-muted" />
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mes anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mes siguiente">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-border px-2 py-2 font-mono text-[10px] tracking-wider text-subtle-muted last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {CALENDAR_WEEKS.map((week, wi) =>
            week.map((day, di) => {
              const month = monthOf(wi, di);
              const key = dayKey(day, month);
              const evt = calendar[key];
              const otherMonth = month !== 6;
              const isToday = key === "2026-06-08";

              return (
                <div
                  key={`${wi}-${di}`}
                  className={cn(
                    "relative min-h-[78px] border-b border-r border-border last:border-r-0",
                    otherMonth && "bg-background/80",
                  )}
                >
                  {evt && (
                    <span
                      className={cn("absolute left-0 right-0 top-0 h-0.5", statusBar[evt.estado])}
                    />
                  )}
                  <div className="flex items-center justify-between px-2 pt-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        otherMonth && "text-subtle-muted",
                        isToday && "font-semibold text-warning",
                        !otherMonth && !isToday && "text-muted-foreground",
                      )}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="font-mono text-[8px] tracking-wider text-warning">
                        HOY
                      </span>
                    )}
                  </div>
                  {evt && (
                    <Link
                      href={`/events/${evt.id}`}
                      className="mx-1.5 mb-1.5 block rounded px-1.5 py-1 transition-colors hover:brightness-110"
                      style={{
                        background:
                          evt.estado === "Completo"
                            ? "rgba(63,159,106,0.12)"
                            : evt.estado === "Crítico"
                              ? "rgba(212,52,38,0.12)"
                              : evt.estado === "Incompleto"
                                ? "rgba(232,168,44,0.12)"
                                : "rgba(122,114,105,0.12)",
                      }}
                    >
                      <EventTypeBadge tipo={evt.tipo} />
                      <p className="mt-1 truncate text-[10.5px] font-medium leading-tight text-foreground-secondary">
                        {evt.label}
                      </p>
                    </Link>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
