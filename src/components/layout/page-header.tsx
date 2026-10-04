import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Cabecera de página: título, una línea que dice qué hay y las acciones.
 *
 * Sin rótulo encima del título (antes repetía el grupo del menú —«Jueces»,
 * «Competiciones»—, que ya dicen la miga de pan y el menú lateral). Las
 * acciones van a la derecha del título en escritorio y debajo, a lo ancho,
 * en móvil, donde pueden pasar a varias líneas sin salirse de la pantalla.
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {/* text-balance / text-pretty: reparte el título en líneas de largo
            parecido y evita que la descripción deje una palabra huérfana al
            final —los títulos de esta app rompen a dos líneas en portátil. */}
        <h1 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-display">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-prose text-pretty text-ui leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {children ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div> : null}
    </div>
  );
}
