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
        "overflow-hidden border transition-shadow duration-300",
        style.border,
        style.glow,
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center gap-2 pb-1">
        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
        <CardTitle className={cn("text-sm font-medium", tokens.text.muted)}>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold tracking-tight", style.value)}>{value}</p>
        {sub ? <p className={cn("mt-1.5 text-xs", tokens.text.subtle)}>{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
