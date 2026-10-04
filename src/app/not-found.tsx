import Link from "next/link";
import { Button } from "@/components/ui/button";

// Un solo enlace a «/»: desde ahí cada cual acaba en su sitio (la gestión en
// el panel, el juez en su portal, quien no ha entrado en el acceso), así que
// no hace falta leer la sesión para elegir destino.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">No encontramos esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          La dirección no existe, la página se ha movido o no tienes acceso a ella.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
