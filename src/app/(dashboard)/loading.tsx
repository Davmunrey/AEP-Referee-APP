import { Skeleton } from "@/components/ui/skeleton";

/** Misma disposición que el panel: encabezado, franja de cifras y dos filas. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1360px] space-y-3 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 xl:space-y-4">
      <div className="space-y-2 pb-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 px-5 py-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {[0, 1].map((row) => (
        <div key={row} className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className={row === 0 ? "h-36 w-full rounded-lg" : "h-80 w-full rounded-lg"} />
          </div>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
