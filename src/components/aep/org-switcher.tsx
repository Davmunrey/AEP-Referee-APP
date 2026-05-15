"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Flag, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/client";
import type { DemoPersona } from "@/lib/auth/demo";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  collapsed?: boolean;
  currentPersona: DemoPersona;
  personas: DemoPersona[];
  demoEnabled: boolean;
}

export function OrgSwitcher({
  collapsed,
  currentPersona,
  personas,
  demoEnabled,
}: OrgSwitcherProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const onSelect = async (persona: DemoPersona) => {
    if (persona.id === currentPersona.id) return;
    setLoadingId(persona.id);
    try {
      await api.switchDemoPersona(persona.id);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  };

  const triggerContent = collapsed ? (
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface transition-colors hover:bg-surface-active">
      {loadingId ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Flag className="h-4 w-4 text-primary" />
      )}
    </span>
  ) : (
    <span
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2.5 text-left transition-all hover:border-border-strong hover:bg-surface-hover",
        loadingId && "opacity-70",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20">
          {loadingId ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Flag className="h-3.5 w-3.5 text-primary" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-foreground">
            {currentPersona.org}
          </span>
          <span className="block truncate text-[10px] text-subtle-muted">{currentPersona.label}</span>
        </span>
      </span>
      {demoEnabled && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle-muted" />}
    </span>
  );

  if (!demoEnabled) {
    return (
      <div className={cn(collapsed && "flex justify-center")} title={currentPersona.org}>
        {triggerContent}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn("w-full outline-none", collapsed && "mx-auto flex w-auto")}
          aria-label="Cambiar plataforma demo"
        >
          {triggerContent}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-subtle-muted">
          Cambiar plataforma
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {personas.map((persona) => (
          <DropdownMenuItem
            key={persona.id}
            onSelect={() => void onSelect(persona)}
            className="flex flex-col items-start gap-0.5 rounded-lg py-2.5"
          >
            <span className="flex w-full items-center gap-2">
              <span className="text-xs font-medium text-foreground">{persona.org}</span>
              {persona.id === currentPersona.id && (
                <Check className="ml-auto h-3.5 w-3.5 text-primary" />
              )}
              {loadingId === persona.id && (
                <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-subtle-muted" />
              )}
            </span>
            <span className="text-[11px] text-subtle-muted">{persona.subtitle}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
