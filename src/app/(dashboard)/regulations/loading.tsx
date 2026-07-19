import { Skeleton } from "@/components/ui/skeleton";

export default function RegulationsLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Content card */}
      <div className="space-y-5 rounded-xl border border-border p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
