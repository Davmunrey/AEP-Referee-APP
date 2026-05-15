import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComingSoonProps {
  moduleName: string;
}

export function ComingSoon({ moduleName }: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-surface">
        <Sparkles className="h-6 w-6 text-subtle-muted" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Módulo <span className="text-warning">{moduleName}</span>
      </h2>
      <p className="mt-2 text-sm text-subtle-muted">
        Este módulo está planificado en la hoja de ruta. Mientras tanto, usa el Dashboard o el
        Constructor de Tarima.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/events/evt-001">Constructor Tarima</Link>
        </Button>
      </div>
    </div>
  );
}
