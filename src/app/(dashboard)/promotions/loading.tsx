import { Skeleton } from "@/components/ui/skeleton";

export default function PromotionsLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Request cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
