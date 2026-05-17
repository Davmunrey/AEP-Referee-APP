import Link from "next/link";
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
    "bg-purple-500/15 text-purple-400",
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
        <Link href="/approvals" className="text-xs font-medium text-primary hover:text-primary/80">
          Ver todo →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {activity.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground/60">
            Sin actividad reciente.
          </p>
        )}
        <ul>
          {activity.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
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
                  <time className="font-mono text-[10px] text-muted-foreground/50">
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
