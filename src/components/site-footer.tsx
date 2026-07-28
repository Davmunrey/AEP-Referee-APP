import Link from "next/link";

/**
 * Pie de página para pantallas públicas (login). En la app autenticada no se
 * muestra: Documentación/Privacidad/Contacto viven en /docs y el widget Ayuda.
 */
export function SiteFooter({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={`flex flex-col items-center gap-1.5 text-center text-[11px] text-muted-foreground ${className}`}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link
          href="/docs"
          className="rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-ring"
        >
          Documentación
        </Link>
        <span aria-hidden="true" className="text-border">·</span>
        <Link
          href="/docs#privacidad"
          className="rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-ring"
        >
          Privacidad
        </Link>
        <span aria-hidden="true" className="text-border">·</span>
        <Link
          href="/docs#contacto"
          className="rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-ring"
        >
          Contacto
        </Link>
      </nav>
      <p>© {year} Asociación Española de Powerlifting · AEP Tarima</p>
    </footer>
  );
}
