"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { DemoPersona } from "@/lib/auth/demo";
import { demoRoleTokens, tokens } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Building2, Eye, Loader2, MapPin, Trophy } from "lucide-react";

interface DemoPersonaPickerProps {
  personas: DemoPersona[];
}

const ROLE_ICON = {
  nacional: Trophy,
  regional: MapPin,
  lectura: Eye,
} as const;

export function DemoPersonaPicker({ personas }: DemoPersonaPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enterAs = async (persona: DemoPersona) => {
    setLoadingId(persona.id);
    setError(null);
    try {
      await api.switchDemoPersona(persona.id);
      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar de persona");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5">
        {personas.map((persona) => {
          const style = demoRoleTokens[persona.role];
          const Icon = ROLE_ICON[persona.role];
          const loading = loadingId === persona.id;
          return (
            <button
              key={persona.id}
              type="button"
              disabled={!!loadingId}
              onClick={() => void enterAs(persona)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border border-border bg-gradient-to-r p-3.5 text-left transition-all",
                "hover:border-border-strong hover:bg-surface-hover hover:ring-2",
                style.ring,
                style.bg,
                loading && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface",
                  style.icon,
                )}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", tokens.text.primary)}>
                  {persona.org}
                </span>
                <span className={cn("block text-xs", tokens.text.muted)}>{persona.label}</span>
              </span>
              <Building2
                className={cn(
                  "h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                  tokens.text.subtleMuted,
                )}
              />
            </button>
          );
        })}
      </div>
      {error && (
        <p
          className={cn(
            "rounded-xl border px-3 py-2 text-center text-sm",
            tokens.border.destructive,
            tokens.bg.destructiveMuted,
            tokens.text.brandSoft,
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
