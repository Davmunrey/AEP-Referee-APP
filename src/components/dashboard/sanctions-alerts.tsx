import Link from "next/link";
import { AlertTriangle, ShieldBan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SanctionAlert } from "@/lib/types";

export function SanctionsAlerts({ alerts }: { alerts: SanctionAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <Card className="border-warning-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ShieldBan className="h-4 w-4 text-warning" aria-hidden="true" />
          Sanciones activas
          <span className="rounded-full border border-warning-border bg-warning-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-warning">
            {alerts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-muted px-3 py-2 text-sm"
            >
              <div>
                <Link
                  href={`/referees/${a.refereeId}`}
                  className="rounded-sm font-medium text-primary hover:underline focus-ring"
                >
                  {a.refereeName}
                </Link>
                <p className="text-xs text-subtle-muted">
                  {a.zonaName} · fin {a.fechaFin}
                  {a.kind === "por_vencer" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-warning">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {a.daysLeft}d
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
