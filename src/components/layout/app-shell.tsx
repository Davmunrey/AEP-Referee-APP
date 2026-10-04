"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/lib/types";
import { HelpWidget } from "@/components/help/help-widget";
import { AppRealtimeSync } from "@/components/realtime/app-realtime-sync";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import type { BandejaNotificaciones } from "@/lib/notificaciones";

const COLLAPSE_KEY = "aep-tarima:sidebar-collapsed";

export interface NavCounts {
  competitions: number;
  approvals: number;
  activeRosterHref: string;
}

export function AppShell({
  children,
  currentUser,
  navCounts,
  notificaciones,
}: {
  children: React.ReactNode;
  currentUser: SessionUser;
  navCounts: NavCounts;
  notificaciones?: BandejaNotificaciones;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Móvil (< md): sin carril fijo de iconos —se comía 64 px de 390— y con la
  // navegación completa en un cajón que se abre desde la barra superior.
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Cerrar al navegar (también con atrás/adelante) y con Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") {
        setCollapsed(true);
      } else if (stored === null && window.innerWidth < 1024) {
        // Auto-collapse on tablet/iPad (first visit, no saved preference)
        setCollapsed(true);
      }
    } catch {
      // ignore — Safari private mode, etc.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <div className="hidden md:flex">
        <Sidebar
          collapsed={collapsed}
          currentUser={currentUser}
          navCounts={navCounts}
          onToggle={toggleCollapsed}
        />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="drawer-in relative h-full">
            <Sidebar
              drawer
              collapsed={false}
              currentUser={currentUser}
              navCounts={navCounts}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              top={
                // La búsqueda global de la barra superior se esconde por debajo
                // de 1024 px; en el cajón vuelve a estar a mano.
                <form
                  role="search"
                  className="relative border-b border-border-muted px-4 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = query.trim();
                    if (!q) return;
                    setMobileOpen(false);
                    router.push(`/referees?q=${encodeURIComponent(q)}`);
                  }}
                >
                  <Search
                    className="pointer-events-none absolute left-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-muted"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar jueces…"
                    aria-label="Buscar jueces"
                    className="h-9 rounded-full bg-surface pl-9 text-sm"
                  />
                </form>
              }
            />
          </div>
        </div>
      )}
      {/* El contenido es un panel propio sobre el marco (sidebar + fondo), con
          borde fino y esquinas redondeadas en escritorio. */}
      <div className="app-canvas relative flex min-w-0 flex-1 flex-col md:my-2 md:mr-2 md:overflow-hidden md:rounded-xl md:border md:border-border md:shadow-card">
        <TopBar currentUser={currentUser} onOpenMenu={() => setMobileOpen(true)} notificaciones={notificaciones} />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          {children}
        </main>
      </div>
      <AppRealtimeSync />
      <HelpWidget user={currentUser} />
    </div>
  );
}
