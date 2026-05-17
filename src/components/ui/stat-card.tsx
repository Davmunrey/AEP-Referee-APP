import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { kpiAccentTokens, tokens } from "@/lib/design-tokens";
import type { DashboardKpi } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatAccent = DashboardKpi["accent"] | "neutral";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: StatAccent;
  className?: string;
}

export function StatCard({ label, value, sub, accent = "neutral", className }: StatCardProps) {
  const style = kpiAccentTokens[accent === "neutral" ? "neutral" : accent];

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        style.border,
        style.glow,
        className,
      )}
    >
      <div className={cn("h-0.5 w-full rounded-t-2xl", style.stripe)} aria-hidden="true" />
      <CardHeader className="flex flex-row items-center gap-2 pb-1">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
        <CardTitle className={cn("text-xs font-medium uppercase tracking-widest", tokens.text.muted)}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-[2rem] font-bold leading-none tracking-tight", style.value)}>{value}</p>
        {sub ? <p className={cn("mt-2 text-xs", tokens.text.subtle)}>{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
