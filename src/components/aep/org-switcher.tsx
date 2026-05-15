"use client";

import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  collapsed?: boolean;
  org: string;
  subtitle: string;
}

export function OrgSwitcher({ collapsed, org, subtitle }: OrgSwitcherProps) {
  const content = collapsed ? (
    <span
      className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
      title={org}
    >
      <Flag className="h-4 w-4 text-primary" />
    </span>
  ) : (
    <span className="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20">
        <Flag className="h-3.5 w-3.5 text-primary" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground">{org}</span>
        <span className="block truncate text-[10px] text-subtle-muted">{subtitle}</span>
      </span>
    </span>
  );

  return <div className={cn(collapsed && "flex justify-center")}>{content}</div>;
}
