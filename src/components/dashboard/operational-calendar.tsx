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

const MONTHS_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const statusBar: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-primary",
  Borrador: "bg-subtle-muted",
};

function buildWeeks(year: number, month: number): { day: number; month: number; year: number }[][] {
  const firstDay = new Date(year, month, 1);
  // Monday-based: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; month: number; year: number }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ day: daysInPrev - i, month: prevMonth, year: prevYear });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year });
  }
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - startOffset - daysInMonth + 1, month: nextMonth, year: nextYear });
  }

  const weeks: { day: number; month: number; year: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function OperationalCalendar({
  calendar,
}: {
  calendar: Record<string, CalendarDayEvent>;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const goBack = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const weeks = buildWeeks(viewYear, viewMonth);
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-semibold">Calendario operativo</CardTitle>
          <span className="font-mono text-[11px] text-subtle-muted">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["Completo", "Incompleto", "Crítico", "Borrador"] as EventStatus[]).map((s) => (
            <EventStatusBadge key={s} status={s} />
          ))}
          <span className="mx-2 h-4 w-px bg-muted" />
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mes anterior" onClick={goBack}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mes siguiente" onClick={goNext}>
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
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              const key = dateKey(cell.year, cell.month, cell.day);
              const evt = calendar[key];
              const otherMonth = cell.month !== viewMonth;
              const isToday = key === todayKey;

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
                      {cell.day}
                    </span>
                    {isToday && (
                      <span className="font-mono text-[8px] tracking-wider text-warning">HOY</span>
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
