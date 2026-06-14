"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";
import { pickActiveRosterHref } from "@/lib/nav-utils";
import type { SessionUser } from "@/lib/types";
import { HelpWidget } from "@/components/help/help-widget";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

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
}: {
  children: React.ReactNode;
  currentUser: SessionUser;
  navCounts: NavCounts;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [liveNavCounts, setLiveNavCounts] = useState(navCounts);

  useEffect(() => {
    setLiveNavCounts(navCounts);
  }, [navCounts]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.getCompetitions(), api.getApprovals()])
      .then(([competitions, approvals]) => {
        if (cancelled) return;
        setLiveNavCounts({
          competitions: competitions.length,
          approvals: approvals.filter((a) => a.status === "pendiente").length,
          activeRosterHref: pickActiveRosterHref(competitions),
        });
      })
      .catch(() => {
        // Mantener contadores del servidor si la API falla (sesión expirada, etc.).
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, navCounts]);

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
      <Sidebar
        collapsed={collapsed}
        currentUser={currentUser}
        navCounts={liveNavCounts}
        onToggle={toggleCollapsed}
      />
      <div className="app-mesh relative flex min-w-0 flex-1 flex-col">
        <TopBar currentUser={currentUser} />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          {children}
        </main>
      </div>
      <HelpWidget user={currentUser} />
    </div>
  );
}
