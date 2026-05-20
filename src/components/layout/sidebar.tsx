"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users,
} from "lucide-react";
import { AepLogo } from "@/components/aep/logo";
import { OrgSwitcher } from "@/components/aep/org-switcher";
import { Button } from "@/components/ui/button";

import type { NavCounts } from "@/components/layout/app-shell";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  match: (p: string) => boolean;
};

function buildPrimaryNav(counts: NavCounts): NavItem[] {
  return [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/" },
    {
      href: "/competitions",
      label: "Campeonatos",
      icon: CalendarDays,
      badge: counts.competitions > 0 ? counts.competitions : undefined,
      match: (p) => p === "/competitions" || p === "/competitions/new",
    },
    {
      href: counts.activeRosterHref,
      label: "Tarima activa",
      icon: Layers,
      match: (p) =>
        p.startsWith("/competitions/") && p !== "/competitions" && p !== "/competitions/new",
    },
    {
      href: "/referees",
      label: "Directorio",
      icon: Users,
      match: (p) => p.startsWith("/referees"),
    },
  ];
}

function buildSecondaryNav(counts: NavCounts, canSeeUsers: boolean): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/approvals",
      label: "Aprobaciones",
      icon: CheckCircle2,
      badge: counts.approvals,
      match: (p) => p.startsWith("/approvals"),
    },
    { href: "/promotions", label: "Ascensos", icon: Award, match: (p) => p.startsWith("/promotions") },
    {
      href: "/exams",
      label: "Exámenes",
      icon: GraduationCap,
      match: (p) => p.startsWith("/exams"),
    },
    {
      href: "/reports",
      label: "Informes",
      icon: ClipboardList,
      match: (p) => p.startsWith("/reports"),
    },
    { href: "/analytics", label: "Estadísticas", icon: BarChart3, match: (p) => p.startsWith("/analytics") },
    { href: "/regulations", label: "Normativa IPF", icon: BookOpen, match: (p) => p.startsWith("/regulations") },
  ];
  if (canSeeUsers) {
    items.push({
      href: "/admin/users",
      label: "Usuarios",
      icon: UserCog,
      match: (p) => p.startsWith("/admin"),
    });
  }
  return items;
}

interface SidebarProps {
  collapsed: boolean;
  currentUser: SessionUser;
  navCounts: NavCounts;
  orgLabel: string;
  orgSubtitle: string;
  onToggle: () => void;
}

export function Sidebar({
  collapsed,
  currentUser,
  navCounts,
  orgLabel,
  orgSubtitle,
  onToggle,
}: SidebarProps) {
  const primaryNav = buildPrimaryNav(navCounts);
  const canSeeUsers =
    currentUser.role === "super_admin" || currentUser.role === "delegado_jueces";
  const secondaryNav = buildSecondaryNav(navCounts, canSeeUsers);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

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

      <div className={cn("px-3 pt-3", collapsed && "px-0")}>
        <OrgSwitcher collapsed={collapsed} org={orgLabel} subtitle={orgSubtitle} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
        <nav className={cn("mt-5 flex flex-col gap-1", collapsed ? "px-0" : "px-3")}>
          {!collapsed && <p className="friendly-label mb-2 px-3">Operaciones</p>}
          {primaryNav.map((item) => renderLink(item))}
        </nav>

        <nav className={cn("mt-5 flex flex-col gap-1", collapsed ? "px-0" : "px-3")}>
          {!collapsed && <p className="friendly-label mb-2 px-3">Gestión</p>}
          {secondaryNav.map((item) => renderLink(item))}
        </nav>
      </div>

      <div className={cn("border-t border-border-muted p-3", collapsed && "px-0")}>
        {!collapsed ? (
          <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-border-muted bg-surface-hover p-2.5">
            <Avatar className="h-8 w-8 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {currentUser.iniciales}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{currentUser.nombre}</p>
              <p className="truncate text-[11px] text-subtle-muted">{currentUser.rol}</p>
            </div>
          </div>
        ) : (
          <Avatar className="mx-auto mb-3 h-8 w-8 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/15 text-xs text-primary">
              {currentUser.iniciales}
            </AvatarFallback>
          </Avatar>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 w-full justify-start gap-2 text-subtle-muted hover:text-destructive focus-ring"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onToggle}
          className={cn(
            "justify-center rounded-xl text-subtle-muted hover:bg-surface focus-ring",
            collapsed ? "mx-auto h-9 w-9" : "w-full",
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
