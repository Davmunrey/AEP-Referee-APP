"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { AepLogo } from "@/components/aep/logo";
import { Button } from "@/components/ui/button";

import type { NavCounts } from "@/components/layout/app-shell";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  match: (p: string) => boolean;
};

type NavGroup = { title: string; items: NavItem[] };

/**
 * Navegación agrupada por dominio (5 grupos en vez de 2), respetando el rol:
 * General · Competiciones · Jueces · Referencia · Administración.
 * Los grupos vacíos (p. ej. tras filtrar por rol) se omiten al renderizar.
 */
function buildNavGroups(counts: NavCounts, user: SessionUser): NavGroup[] {
  const isFinancial = user.role === "responsable_financiero_jueces";
  const canCompensation = user.role === "super_admin" || isFinancial;
  const canSeeUsers = user.role === "super_admin" || user.role === "delegado_jueces";

  // — General: visión de conjunto —
  const general: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/" },
    { href: "/analytics", label: "Estadísticas", icon: BarChart3, match: (p) => p.startsWith("/analytics") },
  ];

  // — Competiciones: todo lo ligado a un campeonato/tarima —
  const competiciones: NavItem[] = [
    {
      href: "/competitions",
      label: "Campeonatos",
      icon: CalendarDays,
      badge: counts.competitions > 0 ? counts.competitions : undefined,
      match: (p) => p === "/competitions" || p === "/competitions/new",
    },
  ];
  if (!isFinancial) {
    competiciones.push(
      {
        href: counts.activeRosterHref,
        label: "Tarima activa",
        icon: Layers,
        match: (p) =>
          p.startsWith("/competitions/") &&
          p !== "/competitions" &&
          p !== "/competitions/new" &&
          !p.endsWith("/compensation"),
      },
      {
        href: "/approvals",
        label: "Aprobaciones",
        icon: CheckCircle2,
        badge: counts.approvals,
        match: (p) => p.startsWith("/approvals"),
      },
    );
  }
  if (canCompensation) {
    competiciones.push({
      href: "/compensation",
      label: "Compensación",
      icon: Banknote,
      match: (p) => p === "/compensation" || p.endsWith("/compensation"),
    });
  }

  // — Jueces: gestión del censo y su carrera —
  const jueces: NavItem[] = [
    { href: "/referees", label: "Directorio", icon: Users, match: (p) => p.startsWith("/referees") },
  ];
  if (!isFinancial) {
    jueces.push(
      { href: "/promotions", label: "Ascensos", icon: Award, match: (p) => p.startsWith("/promotions") },
      { href: "/exams", label: "Exámenes", icon: GraduationCap, match: (p) => p.startsWith("/exams") },
      { href: "/reports", label: "Informes", icon: ClipboardList, match: (p) => p.startsWith("/reports") },
    );
  }

  // — Referencia: consulta —
  const referencia: NavItem[] = [
    { href: "/regulations", label: "Normativa", icon: BookOpen, match: (p) => p.startsWith("/regulations") },
    { href: "/docs", label: "Documentación", icon: FileText, match: (p) => p.startsWith("/docs") },
    { href: "/tickets", label: "Soporte", icon: LifeBuoy, match: (p) => p.startsWith("/tickets") },
  ];

  // — Administración —
  const administracion: NavItem[] = [];
  if (canSeeUsers) {
    administracion.push({
      href: "/admin/users",
      label: "Usuarios",
      icon: UserCog,
      match: (p) => p.startsWith("/admin"),
    });
  }

  return [
    { title: "General", items: general },
    { title: "Competiciones", items: competiciones },
    { title: "Jueces", items: jueces },
    { title: "Referencia", items: referencia },
    { title: "Administración", items: administracion },
  ].filter((g) => g.items.length > 0);
}

interface SidebarProps {
  collapsed: boolean;
  currentUser: SessionUser;
  navCounts: NavCounts;
  onToggle: () => void;
  /**
   * Cajón de móvil: siempre expandido, el botón del pie cierra en vez de
   * colapsar y cada enlace cierra el cajón al navegar.
   */
  drawer?: boolean;
  onNavigate?: () => void;
  /** Contenido bajo el logo; en el cajón, la búsqueda de jueces. */
  top?: React.ReactNode;
}

export function Sidebar({
  collapsed,
  currentUser,
  navCounts,
  onToggle,
  drawer = false,
  onNavigate,
  top,
}: SidebarProps) {
  const navGroups = buildNavGroups(navCounts, currentUser);
  const pathname = usePathname();

  const renderLink = (item: NavItem) => {
    const active = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center text-ui font-medium transition-colors duration-(--duration-base) focus-ring",
          collapsed
            ? "mx-auto h-9 w-9 justify-center rounded-lg p-0"
            : "h-8 gap-2.5 rounded-lg px-2.5",
          // Activo: una tarjeta blanca sobre el marco gris, sin halos.
          active && "bg-card text-foreground shadow-sm ring-1 ring-border",
          !active &&
            "text-foreground-secondary hover:bg-surface-hover hover:text-foreground active:bg-surface-active",
        )}
        title={
          collapsed
            ? item.badge
              ? `${item.label} (${item.badge})`
              : item.label
            : undefined
        }
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 transition-colors duration-(--duration-base)",
            active ? "text-brand" : "text-subtle group-hover:text-foreground-secondary",
          )}
        />
        {/* Colapsada, la barra escondía también los contadores: en la tableta
            —que arranca colapsada— nadie veía que había propuestas esperando.
            Ahora queda un punto sobre el icono, y el número en el título. */}
        {collapsed && item.badge != null && item.badge > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-sidebar",
              item.href === "/approvals" ? "bg-primary" : "bg-foreground-secondary",
            )}
          />
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge != null && item.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-md px-1 text-center text-2xs font-medium tabular-nums leading-none",
                  item.href === "/approvals"
                    ? "bg-primary text-primary-foreground"
                    : "text-subtle",
                )}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        // Plegar es instantáneo: animar `width` recalculaba el layout de toda la
        // página en cada fotograma, y la tarima (la pantalla más pesada) lo notaba.
        "flex h-full flex-col bg-sidebar",
        drawer ? "w-(--size-drawer) border-r border-border" : collapsed ? "w-16" : "w-(--size-sidebar)",
      )}
      aria-label="Navegación principal"
    >
      <div className={cn("px-4 pb-2 pt-4", collapsed && "px-0")}>
        <AepLogo collapsed={collapsed} className={collapsed ? "justify-center" : undefined} />
      </div>
      {top}

      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
        {navGroups.map((group, gi) => (
          <nav
            key={group.title}
            className={cn(
              "flex flex-col gap-px",
              gi === 0 ? "mt-2" : "mt-4",
              collapsed ? "px-0" : "px-2.5",
            )}
            aria-label={group.title}
          >
            {!collapsed && (
              <p className="mb-1 px-2.5 text-2xs font-medium text-subtle">{group.title}</p>
            )}
            {group.items.map((item) => renderLink(item))}
          </nav>
        ))}
      </div>

      <div className={cn("p-2.5", collapsed && "px-0")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onToggle}
          className={cn(
            "justify-start rounded-lg text-subtle hover:bg-surface-hover focus-ring",
            // Colapsado: misma caja que los iconos de navegación (h-11 w-11) para
            // que el chevron quede alineado en la misma columna vertical.
            collapsed ? "mx-auto h-9 w-9 justify-center p-0" : "h-8 w-full px-2.5",
          )}
          aria-label={drawer ? "Cerrar menú" : collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {drawer ? (
            <X className="h-4 w-4" />
          ) : collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          {!collapsed && <span className="ml-2 text-xs">{drawer ? "Cerrar" : "Colapsar"}</span>}
        </Button>
      </div>
    </aside>
  );
}
