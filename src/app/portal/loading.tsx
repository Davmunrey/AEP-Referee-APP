import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto del portal mientras llega la página.
 *
 * Sin este límite de carga, tocar una pestaña del portal no hacía nada visible
 * hasta que el servidor terminaba la página entera (ni siquiera cambiaba la
 * pestaña activa), y en una ruta dinámica el prefetch del enlace no traía nada
 * útil. Ahora el toque responde al momento y el esqueleto se pinta dentro del
 * `<main>` de PortalShell (cabecera, campana y pestañas siguen vivas).
 *
 * Estático a propósito: no lee la sesión ni datos del juez. Por eso no lleva el
 * envoltorio de ancho del panel: ya lo pone el `<main>` del portal.
 */
export default function PortalLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      {[0, 1].map((section) => (
        <div key={section} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: section === 0 ? 2 : 1 }).map((_, i) => (
            <div key={i} className="surface-card space-y-2 rounded-xl px-4 py-3">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
