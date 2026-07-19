import { Skeleton } from "@/components/ui/skeleton";

export default function TicketDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Volver */}
      <Skeleton className="h-8 w-24" />

      {/* Cabecera */}
      <div className="space-y-2 rounded-lg border border-border p-5">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-52" />
      </div>

      {/* Descripción + fotos */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Estado */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {/* Comentarios */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border-muted p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
