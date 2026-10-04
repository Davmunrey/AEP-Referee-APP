import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Franja de cifras */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border-muted sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`space-y-2 bg-card px-4 py-3.5 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
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
