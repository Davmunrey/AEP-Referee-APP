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
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Color for competition dot / top strip by status */
const statusDot: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-destructive",
  // bg-subtle: mismo gris que usa Borrador en coverage-forecast y kpi-cards.
  Borrador: "bg-subtle",
};

// Clases semánticas, no rgba() sueltos: los tonos hex anteriores ni siquiera
// pertenecían a la paleta del tema.
// El hover sube el mismo tinte de estado (10% → 22%) en lugar de aclarar con
// `brightness`: sobre un tinte claro el filtro casi no se nota y además lava
// el color del texto encima, que no debería moverse.
const statusCellClass: Record<EventStatus, string> = {
  Completo: "bg-success/10 hover:bg-success/22",
  Crítico: "bg-destructive/10 hover:bg-destructive/22",
  Incompleto: "bg-warning/10 hover:bg-warning/22",
  Borrador: "bg-subtle/10 hover:bg-subtle/22",
};

function buildWeeks(year: number, month: number): { day: number; month: number; year: number }[][] {
  const firstDay = new Date(year, month, 1);
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
  calendar: Record<string, CalendarDayEvent[]>;
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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-semibold">Calendario operativo</CardTitle>
          <span className="text-sm font-medium text-foreground/70">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["Completo", "Incompleto", "Crítico", "Borrador"] as EventStatus[]).map((s) => (
            <EventStatusBadge key={s} status={s} />
          ))}
          <span className="mx-1.5 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            aria-label="Mes anterior"
            onClick={goBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            aria-label="Mes siguiente"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Weekday headers */}
        {/* select-none: las iniciales de los días son cromo de la rejilla; al
            arrastrar sobre el calendario no deberían quedar seleccionadas. */}
        <div className="grid select-none grid-cols-7 border-b border-border bg-surface/50">
          {WEEKDAYS.map((d, idx) => (
            <div
              key={d}
              className={cn(
                "border-r border-border/50 px-2 py-1.5 font-mono text-[10px] tracking-widest last:border-r-0",
                // Weekend tone (SAB=5, DOM=6)
                idx >= 5 ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              const key = dateKey(cell.year, cell.month, cell.day);
              const dayEvents = calendar[key] ?? [];
              const evt = dayEvents[0];
              const extraEvents = dayEvents.length - 1;
              const otherMonth = cell.month !== viewMonth;
              const isToday = key === todayKey;
              const isWeekend = di >= 5;

              return (
                <div
                  key={`${wi}-${di}`}
                  className={cn(
                    // min-w-0: sin él, el badge whitespace-nowrap fuerza columnas
                    // de >66px y la rejilla de 7 desborda (días recortados en móvil).
                    "relative min-h-[64px] min-w-0 overflow-hidden border-b border-r border-border/50 last:border-r-0 xl:min-h-[68px]",
                    otherMonth && "bg-surface/30 opacity-50",
                    isWeekend && !otherMonth && "bg-surface/40",
                  )}
                >
                  {/* Status top strip */}
                  {evt && (
                    <span
                      className={cn("absolute left-0 right-0 top-0 h-0.5", statusDot[evt.estado])}
                    />
                  )}

                  {/* Day number */}
                  <div className="flex items-center justify-between px-2 pt-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center font-mono text-[11px] tabular-nums",
                        isToday
                          ? "rounded-full bg-primary font-bold text-primary-foreground"
                          : otherMonth
                            ? "text-muted-foreground/30"
                            : isWeekend
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                    {/* Status dot for events */}
                    {evt && !isToday && (
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", statusDot[evt.estado])}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Event block */}
                  {evt && (
                    <Link
                      href={`/competitions/${evt.id}`}
                      className={cn(
                        "mx-1.5 mb-1.5 mt-0.5 block rounded-lg px-1.5 py-1 transition-colors focus-ring",
                        statusCellClass[evt.estado],
                        evt.rangePosition === "middle" && "rounded-l-none rounded-r-none",
                        evt.rangePosition === "start" && "rounded-r-none",
                        evt.rangePosition === "end" && "rounded-l-none",
                      )}
                      title={dayEvents
                        .map(
                          (e) =>
                            `${e.label} · ${e.fecha}${e.fechaFin !== e.fecha ? ` → ${e.fechaFin}` : ""}`,
                        )
                        .join("\n")}
                    >
                      {/* En móvil solo la etiqueta truncada: el badge nowrap desbordaba la rejilla. */}
                      <span className="hidden md:block">
                        <EventTypeBadge tipo={evt.tipo} />
                      </span>
                      <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-foreground/70">
                        {evt.label}
                      </p>
                    </Link>
                  )}

                  {/* Varios campeonatos el mismo día: antes el último pisaba a
                      los anteriores y solo se veía uno. */}
                  {extraEvents > 0 && (
                    <p className="mx-1.5 mb-1.5 text-[10px] font-medium leading-tight text-muted-foreground">
                      +{extraEvents} más
                    </p>
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
