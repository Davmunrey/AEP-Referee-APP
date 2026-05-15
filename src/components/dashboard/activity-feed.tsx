import Link from "next/link";
import { ActivityTypeBadge } from "@/components/aep/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/types";

export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
        <Link href="/approvals" className="text-xs font-medium text-primary hover:text-primary-soft">
          Ver todo →
        </Link>
      </CardHeader>
      <CardContent className="divide-y divide-border-muted p-0">
        {activity.map((item, i) => (
          <div key={i} className="px-4 py-3 transition-colors hover:bg-surface-hover">
            <div className="mb-1 flex items-center gap-2">
              <ActivityTypeBadge tipo={item.tipo} />
              <span className="font-mono text-[10px] text-subtle-muted">{item.hace}</span>
            </div>
            <p className="text-[12px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">{item.actor}</span> {item.accion}{" "}
              <span className="text-foreground-secondary">{item.evento}</span>
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
