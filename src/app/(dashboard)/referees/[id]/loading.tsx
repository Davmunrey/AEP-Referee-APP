import { Skeleton } from "@/components/ui/skeleton";

export default function RefereeDetailLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Back button */}
      <Skeleton className="h-8 w-28" />

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Hero card */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-52" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>

      {/* History card */}
      <div className="space-y-2 rounded-xl border border-border p-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-72" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>

      {/* Data + trajectory */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Data fields — 3/5 */}
        <div className="rounded-xl border border-border p-4 lg:col-span-3">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>

        {/* Trajectory stats — 2/5 */}
        <div className="grid grid-cols-2 content-start gap-4 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border px-4 py-3.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Extra list card */}
      <div className="space-y-2 rounded-xl border border-border p-4">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
