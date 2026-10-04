import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AepLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function AepLogo({ collapsed, className }: AepLogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 rounded-lg focus-ring", className)}>
      {/* El símbolo lleva un cuadro negro que en oscuro desaparecería: hay
          una variante clara y cada una se muestra solo en su tema. */}
      <Image
        src="/assets/aep-mark.png"
        alt="AEP"
        width={collapsed ? 34 : 38}
        height={collapsed ? 34 : 38}
        className="shrink-0 dark:hidden"
        priority
      />
      <Image
        src="/assets/aep-mark-dark.png"
        alt="AEP"
        width={collapsed ? 34 : 38}
        height={collapsed ? 34 : 38}
        className="hidden shrink-0 dark:block"
      />
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            AEP Tarima
          </p>
          <p className="mt-1 text-2xs font-medium text-subtle-muted">
            Gestión de jueces
          </p>
        </div>
      )}
    </Link>
  );
}
