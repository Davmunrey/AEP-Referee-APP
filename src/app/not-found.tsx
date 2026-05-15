import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Evento no encontrado</h1>
      <p className="text-muted-foreground">El campeonato solicitado no existe en el sistema.</p>
      <Button asChild>
        <Link href="/">Volver al dashboard</Link>
      </Button>
    </div>
  );
}
