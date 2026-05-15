"use client";

import { useState } from "react";
import type { DemoPersona } from "@/lib/auth/demo";
import type { CurrentUser } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export interface NavCounts {
  events: number;
  approvals: number;
}

export function AppShell({
  children,
  currentUser,
  navCounts,
  demoEnabled,
  personas,
  currentPersona,
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
  navCounts: NavCounts;
  demoEnabled: boolean;
  personas: DemoPersona[];
  currentPersona: DemoPersona;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        currentUser={currentUser}
        navCounts={navCounts}
        demoEnabled={demoEnabled}
        personas={personas}
        currentPersona={currentPersona}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="app-mesh relative flex min-w-0 flex-1 flex-col">
        <TopBar currentUser={currentUser} demoEnabled={demoEnabled} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
