"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, Home, LogOut, Megaphone, UserRound } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { BandejaNotificaciones } from "@/lib/notificaciones";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Inicio", icon: Home, exact: true },
  { href: "/portal/convocatorias", label: "Convocatorias", icon: Megaphone },
  { href: "/portal/sesiones", label: "Mis sesiones", icon: CalendarCheck },
  { href: "/portal/ficha", label: "Mi ficha", icon: UserRound },
] as const;

/**
 * Marco del portal del juez. Pensado para el móvil, que es donde lo va a abrir
 * un juez: barra de pestañas abajo en pantallas pequeñas y arriba en las
 * grandes. Nada del menú de la gestión.
 */
export function PortalShell({
  nombre,
  iniciales,
  notificaciones,
  children,
}: {
  nombre: string;
  iniciales: string;
  notificaciones: BandejaNotificaciones;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const signOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    router.push("/sign-in");
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border-muted bg-canvas">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-ring">
            <Image src="/assets/aep-mark.png" alt="" width={28} height={28} className="shrink-0 dark:hidden" priority />
            <Image src="/assets/aep-mark-dark.png" alt="" width={28} height={28} className="hidden shrink-0 dark:block" />
            <span className="truncate text-sm font-semibold text-foreground">Portal del juez</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell initial={notificaciones} />
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-active text-[11px] font-semibold text-foreground-secondary"
              title={nombre}
              aria-hidden="true"
            >
              {iniciales}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-ring"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
              <span className="sr-only sm:hidden">Cerrar sesión</span>
            </button>
          </div>
        </div>
        <nav aria-label="Portal" className="mx-auto hidden max-w-3xl gap-1 px-3 pb-2 sm:flex">
          {NAV.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(href, "exact" in rest && rest.exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors focus-ring",
                  active ? "bg-surface-active font-medium text-foreground" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Sin sincronización en tiempo real a propósito: cada edición de la
          gestión haría refrescar cientos de portales abiertos. El juez ve lo
          nuevo al navegar o volver a la pestaña, y lo urgente le llega a la
          campana. */}
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:pb-12">{children}</main>

      {/* Móvil: pestañas abajo, al alcance del pulgar. */}
      <nav
        aria-label="Portal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border-muted bg-canvas pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {NAV.map(({ href, label, icon: Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest && rest.exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
