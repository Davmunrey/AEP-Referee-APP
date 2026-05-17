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
      <Image
        src="/assets/aep-mark.png"
        alt="AEP"
        width={collapsed ? 34 : 38}
        height={collapsed ? 34 : 38}
        className="shrink-0"
        priority
      />
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            AEP Tarima
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-subtle-muted">
            Gestión de jueces
          </p>
        </div>
      )}
    </Link>
  );
}
