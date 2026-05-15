"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/types";
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
  orgLabel,
  orgSubtitle,
}: {
  children: React.ReactNode;
  currentUser: SessionUser;
  navCounts: NavCounts;
  orgLabel: string;
  orgSubtitle: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        currentUser={currentUser}
        navCounts={navCounts}
        orgLabel={orgLabel}
        orgSubtitle={orgSubtitle}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="app-mesh relative flex min-w-0 flex-1 flex-col">
        <TopBar currentUser={currentUser} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
