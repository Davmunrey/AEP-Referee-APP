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
      href: "/events",
      label: "Campeonatos",
      icon: CalendarDays,
      badge: counts.events,
      match: (p) => p === "/events",
    },
    {
      href: "/referees",
      label: "Directorio",
      icon: Users,
      match: (p) => p.startsWith("/referees"),
    },
    {
      href: "/events",
      label: "Constructor Tarima",
      icon: Layers,
      match: (p) => p.startsWith("/events/") && p !== "/events",
    },
  ];
}

function buildSecondaryNav(counts: NavCounts, isNacional: boolean): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/approvals",
      label: "Aprobaciones",
      icon: CheckCircle2,
      badge: counts.approvals,
      match: (p) => p.startsWith("/approvals"),
    },
    { href: "/promotions", label: "Ascensos", icon: Award, match: (p) => p.startsWith("/promotions") },
    { href: "/analytics", label: "Estadísticas", icon: BarChart3, match: (p) => p.startsWith("/analytics") },
    { href: "/regulations", label: "Normativa IPF", icon: BookOpen, match: (p) => p.startsWith("/regulations") },
  ];
  if (isNacional) {
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
  const secondaryNav = buildSecondaryNav(navCounts, currentUser.role === "nacional");
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
        key={item.label}
        href={item.href}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          active
            ? "bg-surface-active text-foreground nav-glow-active shadow-sm"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
        )}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            active ? "bg-primary/20 text-primary" : "bg-surface text-subtle-muted group-hover:text-foreground-secondary",
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
                  "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] font-medium tabular-nums",
                  item.href === "/approvals"
                    ? "bg-primary/20 text-primary-soft"
                    : "bg-surface-active text-muted-foreground",
                )}
              >
                {item.badge}
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
        "flex h-full flex-col border-r border-border-muted bg-sidebar/95 backdrop-blur-xl transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[252px]",
      )}
    >
      <div className={cn("border-b border-border-muted px-4 py-5", collapsed && "px-3")}>
        <AepLogo collapsed={collapsed} />
      </div>

      <div className={cn("px-3 pt-4", collapsed && "px-2")}>
        <OrgSwitcher collapsed={collapsed} org={orgLabel} subtitle={orgSubtitle} />
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-3">
        {!collapsed && <p className="friendly-label mb-2 px-3">Operaciones</p>}
        {primaryNav.map((item) => renderLink(item))}
      </nav>

      <nav className="mt-6 flex flex-col gap-1 px-3">
        {!collapsed && <p className="friendly-label mb-2 px-3">Gestión</p>}
        {secondaryNav.map((item) => renderLink(item))}
      </nav>

      <div className="flex-1" />

      <div className={cn("border-t border-border-muted p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border-muted bg-surface-hover p-3">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {currentUser.iniciales}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{currentUser.nombre}</p>
              <p className="truncate text-[11px] text-subtle-muted">{currentUser.rol}</p>
            </div>
          </div>
        ) : (
          <Avatar className="mx-auto mb-3 h-9 w-9 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/15 text-xs text-primary">
              {currentUser.iniciales}
            </AvatarFallback>
          </Avatar>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 w-full justify-start gap-2 text-subtle-muted hover:text-foreground-secondary"
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
          className="w-full justify-center rounded-xl text-subtle-muted hover:bg-surface"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-xs">Colapsar</span>}
        </Button>
      </div>
    </aside>
  );
}
