import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Cifras resumen de una pantalla: una sola franja con celdas separadas por
 * filetes, la misma que abre el panel de inicio.
 *
 * Antes cada cifra era una tarjeta suelta con un cuadrado de color y su icono
 * (reloj ámbar, check verde, cruz roja…): cuatro tarjetas idénticas en fila,
 * la plantilla de «icono + número + rótulo» que se ve en cualquier panel
 * generado. El icono no decía nada que el rótulo no dijera ya. Ahora la cifra
 * manda, el rótulo la nombra y el tono —si lo hay— es un punto junto al
 * rótulo y el color de la línea secundaria.
 */
export type MetricTone = "neutral" | "warning" | "success" | "danger" | "primary";

const DOT: Record<MetricTone, string | null> = {
  neutral: null,
  primary: "bg-primary",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-destructive",
};

const HINT: Record<MetricTone, string> = {
  neutral: "text-muted-foreground",
  primary: "text-brand",
  warning: "text-warning",
  success: "text-success",
  danger: "text-destructive",
};

/** Columnas en escritorio; en móvil siempre dos. */
const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
};

/**
 * Contenedor de las cifras. El filete entre celdas es el fondo del contenedor
 * asomando por un hueco de 1 px: funciona con cualquier número de columnas y
 * en cualquier punto de corte, sin bordes calculados a mano por posición.
 */
export function MetricStrip({
  children,
  columns = 4,
  className,
  label = "Cifras",
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border-muted shadow-sm",
        COLS[columns],
        className,
      )}
    >
      {children}
    </section>
  );
}

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  tone?: MetricTone;
  /** Línea secundaria bajo la cifra («+ 405 € pendiente de km»). */
  hint?: React.ReactNode;
  /** Si la cifra lleva a la lista que cuenta. */
  href?: string;
  className?: string;
}

export function MetricTile({ label, value, tone = "neutral", hint, href, className }: MetricTileProps) {
  const dot = DOT[tone];
  const body = (
    <>
      {/* El rótulo parte línea en vez de cortarse: en móvil, a dos columnas,
          «Aprobaciones pendientes» no cabe en una y «Aprobaciones pendie…»
          no dice qué se cuenta. */}
      <p className="flex items-start gap-1.5 text-ui leading-snug text-muted-foreground">
        {dot ? <span className={cn("mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" /> : null}
        <span className="text-pretty">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-display font-semibold leading-none tracking-tighter tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className={cn("mt-1.5 text-pretty text-xs tabular-nums", HINT[tone])}>{hint}</p> : null}
    </>
  );
  const cell = cn("block min-w-0 bg-card px-4 py-3.5 sm:px-5", className);
  return href ? (
    <Link
      href={href}
      className={cn(
        cell,
        "transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}
