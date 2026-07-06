import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Two panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border p-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
