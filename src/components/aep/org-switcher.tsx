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
      className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border-muted bg-surface shadow-sm"
      title={org}
      aria-label={org}
    >
      <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
    </span>
  ) : (
    <span className="flex w-full items-center gap-2.5 rounded-xl border border-border-muted bg-surface px-3 py-2.5 shadow-sm">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15"
        aria-hidden="true"
      >
        <Flag className="h-3.5 w-3.5 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-snug text-foreground">
          {org}
        </span>
        <span className="block truncate text-[10px] leading-tight text-subtle-muted">{subtitle}</span>
      </span>
    </span>
  );

  return <div className={cn(collapsed && "flex justify-center")}>{content}</div>;
}
