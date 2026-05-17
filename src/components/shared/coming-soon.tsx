import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComingSoonProps {
  moduleName: string;
}

export function ComingSoon({ moduleName }: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
        <Sparkles className="h-6 w-6 text-primary/60" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        <span className="text-primary">{moduleName}</span> próximamente
      </h2>
      <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-subtle-muted">
        Este módulo está en desarrollo. Mientras tanto puedes usar el Dashboard o el Constructor de
        Tarima.
      </p>
      <div className="mt-7 flex gap-2">
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
