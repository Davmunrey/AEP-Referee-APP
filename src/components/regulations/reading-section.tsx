import { cn } from "@/lib/utils";

/**
 * Sección de lectura de la normativa: título h2 (bajo el h1 de la página) y
 * prosa a ~70 caracteres por línea. Sustituye a la tarjeta por párrafo, que
 * convertía un texto corrido en una pila de cajas iguales sin jerarquía.
 * `wide` deja respirar a las tablas, que no son texto corrido.
 */
export function ReadingSection({
  id,
  title,
  subtitle,
  wide = false,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border-muted pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle ? <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{subtitle}</p> : null}
      <div
        className={cn(
          "mt-3 space-y-3 text-[15px] leading-relaxed text-foreground-secondary",
          wide ? "max-w-3xl" : "max-w-[70ch]",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Tabla de referencia de la normativa: celdas con aire y filas separadas por línea fina. */
export function ReferenceTable({
  head,
  rows,
  numericFrom,
  minWidth,
}: {
  head: string[];
  rows: React.ReactNode[][];
  /** Índice de la primera columna numérica (se alinea a la derecha). */
  numericFrom?: number;
  minWidth?: string;
}) {
  const num = (i: number) => numericFrom !== undefined && i >= numericFrom;
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", minWidth)}>
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("py-2 pr-4 font-medium last:pr-0", num(i) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-muted">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-4 font-medium text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td
                    key={i}
                    className={cn("py-2 pr-4 text-foreground-secondary last:pr-0", num(i) && "text-right tabular-nums")}
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
