"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPageMeta } from "@/lib/navigation";
import type { CurrentUser } from "@/lib/types";

export function TopBar({ currentUser }: { currentUser: CurrentUser }) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);
  const hideSearch = pathname.startsWith("/events/");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-muted bg-sidebar/80 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <nav className="hidden items-center gap-1.5 text-[12px] text-subtle-muted md:flex">
          {meta.crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-subtle-muted" />}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground-secondary">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground-secondary">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        {meta.title && !pathname.startsWith("/events/") && (
          <div className="hidden min-w-0 border-l border-border-muted pl-4 lg:block">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {meta.title}
            </h1>
            {meta.subtitle && <p className="text-xs text-subtle-muted">{meta.subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {!hideSearch && (
          <div className="relative hidden max-w-xs md:block">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar campeonatos, árbitros…"
              className="h-9 w-64 rounded-full border-border-muted bg-surface pl-9 text-xs"
              aria-label="Buscar"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:bg-surface-hover"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
        </Button>
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground">{currentUser.nombre}</p>
          <p className="max-w-[140px] truncate text-[10px] text-subtle-muted">{currentUser.rol}</p>
        </div>
        <Avatar className="h-9 w-9 ring-2 ring-border">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {currentUser.iniciales}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
