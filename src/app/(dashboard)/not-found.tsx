import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-3xl font-bold text-muted-foreground/30">
        404
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          La página que buscas no existe o ha sido movida.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Volver al panel
      </Link>
    </div>
  );
}
