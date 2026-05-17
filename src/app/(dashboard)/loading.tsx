export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <p className="text-xs font-medium text-muted-foreground/60">Cargando panel…</p>
    </div>
  );
}
