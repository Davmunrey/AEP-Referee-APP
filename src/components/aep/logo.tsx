import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AepLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function AepLogo({ collapsed, className }: AepLogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/assets/aep-master-logo-light.png"
        alt="AEP"
        width={collapsed ? 32 : 36}
        height={collapsed ? 32 : 36}
        className="shrink-0 rounded-lg ring-1 ring-border"
        priority
      />
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <p className="text-sm font-semibold tracking-tight text-foreground">Tarima</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-subtle-muted">
            AEP · v1.0
          </p>
        </div>
      )}
    </Link>
  );
}
