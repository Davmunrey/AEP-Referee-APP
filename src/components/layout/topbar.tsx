"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useEventCrumbLabel } from "@/components/layout/event-crumb-label";
import { getPageMeta } from "@/lib/navigation";
import type { CurrentUser } from "@/lib/types";

export function TopBar({ currentUser }: { currentUser: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = getPageMeta(pathname);
  const eventIdCrumb = pathname.match(/^\/events\/([^/]+)$/)?.[1];
  const eventCrumbLabel = useEventCrumbLabel(eventIdCrumb ?? "Campeonato");
  const hideSearch = pathname.startsWith("/events/");
  const [query, setQuery] = useState("");

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/referees?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border-muted bg-sidebar/80 px-4 sm:px-5 lg:px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <nav className="hidden items-center gap-1.5 text-[12px] text-subtle-muted md:flex">
          {meta.crumbs.map((crumb, i) => {
            const isLast = i === meta.crumbs.length - 1;
            const label =
              isLast && eventIdCrumb && eventIdCrumb !== "new" ? eventCrumbLabel : crumb.label;
            return (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 text-subtle-muted" aria-hidden="true" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded-sm transition-colors hover:text-foreground-secondary focus-ring"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground-secondary">{label}</span>
                )}
              </span>
            );
          })}
        </nav>
        {meta.title && !pathname.startsWith("/events/") && (
          <div className="hidden min-w-0 border-l border-border-muted pl-3 xl:block">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {meta.title}
            </h1>
            {meta.subtitle && <p className="text-xs text-subtle-muted">{meta.subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {!hideSearch && (
          <div className="relative hidden max-w-xs lg:block">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar jueces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              className="h-8 w-56 rounded-full border-border bg-surface pl-9 text-xs transition-all duration-150 hover:border-border-strong focus-visible:border-primary-border xl:w-60 xl:focus-visible:w-[17rem]"
              aria-label="Buscar jueces — pulsa Enter"
            />
          </div>
        )}
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground">{currentUser.nombre}</p>
          <p className="max-w-[140px] truncate text-[10px] text-subtle-muted">{currentUser.rol}</p>
        </div>
        <Avatar className="h-8 w-8 ring-2 ring-border">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {currentUser.iniciales}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
