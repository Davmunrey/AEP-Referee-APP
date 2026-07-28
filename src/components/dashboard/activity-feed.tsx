import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { ActivityTypeBadge } from "@/components/aep/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Two-letter initials from a name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Subtle hue from name — picks one of a few palette slots deterministically. */
function avatarColor(name: string): string {
  const palette = [
    "bg-primary/15 text-primary",
    "bg-info/15 text-info-soft",
    "bg-success/15 text-success",
    "bg-warning/15 text-warning",
    "bg-surface-active text-foreground-secondary",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}

/** How long ago — short, friendly tone. */
function relativeTime(hace: string): string {
  return hace; // already computed server-side; preserve it
}

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:text-primary/80 focus-ring"
        >
          Ver todo
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {activity.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground/70">Sin actividad reciente</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los cambios en tarimas, aprobaciones y censo aparecerán aquí.
              </p>
            </div>
          </div>
        )}
        <ul>
          {activity.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 px-4 py-3"
            >
              {/* Actor avatar */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  avatarColor(item.actor),
                )}
                aria-hidden="true"
              >
                {initials(item.actor)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActivityTypeBadge tipo={item.tipo} />
                  <time className="font-mono text-[10px] text-muted-foreground">
                    {relativeTime(item.hace)}
                  </time>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground/90">{item.actor}</span>{" "}
                  {item.accion}{" "}
                  <span className="text-foreground/70">{item.evento}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
