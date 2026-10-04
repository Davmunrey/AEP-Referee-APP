"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CalendarDayEvent, EventStatus } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { businessDayIso } from "@/lib/business-date";
import { zoneUiName } from "@/lib/aep-zones";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Eventos visibles por celda en la rejilla; el resto va en «+N». */
const MAX_PER_CELL = 2;

/**
 * Un único código de color por estado: un punto delante del nombre, el mismo
 * de la leyenda. Antes el estado se repetía cuatro veces por día (franja
 * superior, punto, fondo teñido e insignia); después pasó a una franja gruesa
 * en el borde izquierdo, que es un adorno de tarjeta más que una señal.
 */
const statusDot: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-destructive",
  Borrador: "bg-subtle",
};
const STATUS_ORDER: EventStatus[] = ["Completo", "Incompleto", "Crítico", "Borrador"];

type Cell = { day: number; month: number; year: number; key: string; weekday: number };

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildWeeks(year: number, month: number): Cell[][] {
  // Fechas de calendario puras (UTC): el día de la semana no depende del huso
  // de quien renderiza.
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month, 1 - startOffset);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const weeks: Cell[][] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(start + i * 86_400_000);
    const cell: Cell = {
      day: d.getUTCDate(),
      month: d.getUTCMonth(),
      year: d.getUTCFullYear(),
      key: dateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      weekday: i % 7,
    };
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push(cell);
  }
  return weeks;
}

function rangeText(e: CalendarDayEvent) {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS_ES[(m ?? 1) - 1]?.slice(0, 3)}`;
  };
  return e.fechaFin !== e.fecha ? `${fmt(e.fecha)} – ${fmt(e.fechaFin)}` : fmt(e.fecha);
}

function eventTitle(e: CalendarDayEvent) {
  return [
    e.label,
    [e.tipo, e.zona ? zoneUiName(e.zona) : null, e.sede].filter(Boolean).join(" · "),
    `${rangeText(e)} · ${e.estado}`,
  ].join("\n");
}

/** Barra de un campeonato en una celda de la rejilla. */
function EventBar({
  event,
  weekday,
  past,
  labelSpan,
}: {
  event: CalendarDayEvent;
  weekday: number;
  past: boolean;
  /** Días (esta semana, misma fila) por los que puede correr el nombre. */
  labelSpan: number;
}) {
  const pos = event.rangePosition;
  // En un campeonato de varios días el nombre va el primer día y al empezar
  // cada semana; el resto de días la barra continúa sin repetirlo.
  const showLabel = pos === "single" || pos === "start" || weekday === 0;
  const joinsLeft = (pos === "middle" || pos === "end") && weekday !== 0;
  const joinsRight = (pos === "start" || pos === "middle") && weekday !== 6;
  return (
    <Link
      href={`/competitions/${event.id}`}
      title={eventTitle(event)}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-surface px-1.5 text-2xs font-medium leading-none text-foreground transition-colors hover:bg-surface-active focus-ring",
        past && "text-muted-foreground",
        // La barra cruza el borde de la celda para unirse con la del día vecino.
        joinsLeft && "-ml-[7px] rounded-l-none pl-2",
        joinsRight && "-mr-[7px] rounded-r-none",
      )}
    >
      {showLabel && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", past ? "bg-border-strong" : statusDot[event.estado])}
          aria-hidden="true"
        />
      )}
      {showLabel ? (
        <span
          className="relative z-(--z-raised) min-w-0 shrink-0 truncate"
          // El nombre continúa sobre la barra de los días siguientes en vez de
          // cortarse en la primera celda («Campeonato de…»).
          style={{ maxWidth: `calc(${labelSpan * 100}% + ${(labelSpan - 1) * 12}px)` }}
        >
          {event.label}
        </span>
      ) : (
        <span className="sr-only">{event.label}</span>
      )}
    </Link>
  );
}

export function OperationalCalendar({
  calendar,
}: {
  calendar: Record<string, CalendarDayEvent[]>;
}) {
  // Día natural español, no el del navegador ni el del servidor: este
  // componente se pinta en el servidor (UTC) y se hidrata en el cliente, y con
  // `new Date()` los dos podían abrirlo en meses distintos.
  const todayKey = businessDayIso();
  const [todayYear, todayMonth] = todayKey.split("-").map(Number) as [number, number];
  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth - 1);

  const shift = (delta: number) => {
    const m = viewMonth + delta;
    setViewYear((y) => y + Math.floor(m / 12));
    setViewMonth(((m % 12) + 12) % 12);
  };
  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth - 1;

  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const isPast = (e: CalendarDayEvent) => e.fechaFin < todayKey;

  // Agenda del mes (móvil): solo los días con campeonatos, y cada campeonato
  // una vez —el día que empieza, o el día 1 si viene del mes anterior—.
  const agenda = useMemo(() => {
    const days: { cell: Cell; events: CalendarDayEvent[] }[] = [];
    for (const cell of weeks.flat()) {
      if (cell.month !== viewMonth) continue;
      const events = (calendar[cell.key] ?? []).filter(
        (e) => e.rangePosition === "single" || e.rangePosition === "start" || cell.day === 1,
      );
      if (events.length > 0) days.push({ cell, events });
    }
    return days;
  }, [calendar, weeks, viewMonth]);

  // Días seguidos de la semana en que el campeonato sigue en la misma fila:
  // solo por ahí puede correr su nombre sin pisar otra barra.
  const labelSpan = (week: Cell[], from: number, row: number, id: string) => {
    let span = 1;
    for (let w = from + 1; w < week.length && calendar[week[w]!.key]?.[row]?.id === id; w++) span++;
    return span;
  };

  const monthHasEvents = weeks
    .flat()
    .some((c) => c.month === viewMonth && (calendar[c.key]?.length ?? 0) > 0);

  return (
    <Card role="region" aria-label="Calendario de campeonatos" className="overflow-hidden p-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border-muted px-4 py-3">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-title">Calendario</CardTitle>
          <span className="text-sm text-muted-foreground first-letter:uppercase" aria-live="polite">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => {
              setViewYear(todayYear);
              setViewMonth(todayMonth - 1);
            }}
            disabled={isCurrentMonth}
          >
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mes anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mes siguiente" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Escritorio: rejilla mensual. */}
        <div className="hidden md:block">
          <div className="grid select-none grid-cols-7 border-b border-border-muted">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn("px-2.5 py-2 text-xs font-medium", i >= 5 ? "text-subtle" : "text-muted-foreground")}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.map((week) =>
              week.map((cell) => {
                const events = calendar[cell.key] ?? [];
                const visible = events.slice(0, MAX_PER_CELL);
                const hidden = events.length - visible.length;
                const otherMonth = cell.month !== viewMonth;
                const isToday = cell.key === todayKey;
                return (
                  <div
                    key={cell.key}
                    className={cn(
                      "flex min-h-[104px] min-w-0 flex-col gap-1 border-b border-r border-border-muted p-1.5 [&:nth-child(7n)]:border-r-0",
                      otherMonth && "bg-surface/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : otherMonth
                            ? "text-subtle-muted"
                            : "text-foreground-secondary",
                      )}
                      aria-label={isToday ? `Hoy, ${cell.day}` : undefined}
                    >
                      {cell.day}
                    </span>
                    {visible.map((e, row) => (
                      <EventBar
                        key={e.id}
                        event={e}
                        weekday={cell.weekday}
                        past={isPast(e)}
                        labelSpan={labelSpan(week, cell.weekday, row, e.id)}
                      />
                    ))}
                    {hidden > 0 && (
                      // Antes era texto sin enlace: el tercer campeonato de un día
                      // no tenía forma de abrirse.
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-5 w-fit rounded px-1.5 text-left text-2xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-ring">
                          +{hidden} más
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                            {WEEKDAYS_LONG[cell.weekday]} {cell.day} de {MONTHS_ES[cell.month]}
                          </DropdownMenuLabel>
                          {events.map((e) => (
                            <DropdownMenuItem key={e.id} asChild>
                              <Link href={`/competitions/${e.id}`} className="flex items-center gap-2">
                                <span
                                  className={cn("h-2 w-2 shrink-0 rounded-full", isPast(e) ? "bg-border-strong" : statusDot[e.estado])}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{e.tipo}</span>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Móvil: agenda del mes. Siete columnas de 50 px no dejaban leer nada. */}
        <div className="md:hidden">
          {agenda.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin campeonatos este mes.</p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {agenda.map(({ cell, events }) => (
                <li key={cell.key} className="flex gap-3 px-4 py-3">
                  <div className="w-10 shrink-0 text-center">
                    <p className="text-2xs text-muted-foreground">{WEEKDAYS[cell.weekday]}</p>
                    <p
                      className={cn(
                        "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                        cell.key === todayKey ? "bg-primary text-primary-foreground" : "text-foreground",
                      )}
                    >
                      {cell.day}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {events.map((e) => (
                      <Link
                        key={e.id}
                        href={`/competitions/${e.id}`}
                        className={cn(
                          "block rounded-md bg-surface px-2.5 py-1.5 focus-ring",
                        )}
                      >
                        <p className={cn("flex items-center gap-2 text-sm font-medium", isPast(e) ? "text-muted-foreground" : "text-foreground")}>
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", isPast(e) ? "bg-border-strong" : statusDot[e.estado])}
                            aria-hidden="true"
                          />
                          <span className="truncate">{e.label}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[e.tipo, rangeText(e), e.sede].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Leyenda discreta, al pie y no como una fila de insignias. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-muted px-4 py-2.5 text-xs text-muted-foreground">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", statusDot[s])} aria-hidden="true" />
              {s}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-border-strong" aria-hidden="true" />
            Celebrado
          </span>
          {!monthHasEvents && <span className="ml-auto hidden md:inline">Sin campeonatos este mes</span>}
        </div>
      </CardContent>
    </Card>
  );
}
