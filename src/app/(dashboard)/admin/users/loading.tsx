import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsersLoading() {
  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Form */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-6 w-24 sm:block" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
