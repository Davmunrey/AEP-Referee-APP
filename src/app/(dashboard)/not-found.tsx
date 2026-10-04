import Link from "next/link";
import { Button } from "@/components/ui/button";

// La misma voz que el 404 general: sin la cifra gris de relleno, una frase que
// dice qué ha pasado y una sola salida.
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">No encontramos esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          La dirección no existe, la página se ha movido o no tienes acceso a ella.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Volver al panel</Link>
        </Button>
      </div>
    </div>
  );
}
