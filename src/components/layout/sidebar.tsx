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
  UserCog,
  Users,
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
}

export function Sidebar({
  collapsed,
  currentUser,
  navCounts,
  onToggle,
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
        className={cn(
          "group relative flex items-center text-[12.5px] font-medium transition-colors duration-150 focus-ring",
          collapsed
            ? "mx-auto h-11 w-11 justify-center rounded-xl p-0"
            : "gap-2.5 rounded-xl px-3 py-2",
          active && !collapsed && "bg-surface-active text-foreground nav-glow-active",
          active && collapsed && "bg-primary/8 text-primary ring-1 ring-primary/25",
          !active &&
            "text-muted-foreground hover:bg-surface hover:text-foreground active:bg-surface-hover",
        )}
        title={collapsed ? item.label : undefined}
      >
        {active && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-glow-primary"
          />
        )}
        {active && collapsed && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          />
        )}
        <span
          className={cn(
            "flex shrink-0 items-center justify-center transition-colors duration-150",
            collapsed ? "h-9 w-9 rounded-xl" : "h-8 w-8 rounded-lg",
            active && !collapsed
              ? "bg-primary/15 text-primary"
              : active && collapsed
                ? "bg-transparent text-primary"
              : "bg-transparent text-subtle-muted group-hover:bg-surface group-hover:text-foreground-secondary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge != null && item.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-px text-center font-mono text-[10px] font-semibold tabular-nums leading-none",
                  item.href === "/approvals"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface-active text-foreground-secondary",
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
        "flex h-full flex-col border-r border-border-muted bg-sidebar/95 backdrop-blur-xl transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[224px] xl:w-[232px]",
      )}
    >
      <div className={cn("border-b border-border-muted px-4 py-4", collapsed && "px-0")}>
        <AepLogo collapsed={collapsed} className={collapsed ? "justify-center" : undefined} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
        {navGroups.map((group, gi) => (
          <nav
            key={group.title}
            className={cn(
              "flex flex-col gap-1",
              gi === 0 ? "mt-3" : "mt-5",
              collapsed ? "px-0" : "px-3",
            )}
            aria-label={group.title}
          >
            {!collapsed && <p className="friendly-label mb-2 px-3">{group.title}</p>}
            {group.items.map((item) => renderLink(item))}
          </nav>
        ))}
      </div>

      <div className={cn("border-t border-border-muted p-3", collapsed && "px-0")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onToggle}
          className={cn(
            "justify-center rounded-xl text-subtle-muted hover:bg-surface focus-ring",
            // Colapsado: misma caja que los iconos de navegación (h-11 w-11) para
            // que el chevron quede alineado en la misma columna vertical.
            collapsed ? "mx-auto h-11 w-11 p-0" : "w-full",
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-xs">Colapsar</span>}
        </Button>
      </div>
    </aside>
  );
}
