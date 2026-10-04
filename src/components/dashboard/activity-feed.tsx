import { History } from "lucide-react";
import { ActivityTypeBadge } from "@/components/aep/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/types";

/** Two-letter initials from a name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="overflow-hidden p-0">
      {/* Sin «Ver todo»: llevaba a /approvals, que no es un registro de
          actividad, y no hay otra página que lo sea. */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-muted px-4 py-3">
        <CardTitle>Actividad reciente</CardTitle>
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-active text-2xs font-semibold text-foreground-secondary"
                aria-hidden="true"
              >
                {initials(item.actor)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActivityTypeBadge tipo={item.tipo} />
                  <time className="text-2xs text-muted-foreground">
                    {item.hace}
                  </time>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
