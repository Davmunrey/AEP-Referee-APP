import { Skeleton } from "@/components/ui/skeleton";

export default function ExamsLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Header + nota */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-3.5 w-full max-w-2xl" />
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

      {/* List */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
