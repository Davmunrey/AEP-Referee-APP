"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { request } from "@/lib/api/request";
import type { BandejaNotificaciones } from "@/lib/notificaciones";
import { cn } from "@/lib/utils";

function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/**
 * La campana de avisos. Llega con la bandeja ya leída en el servidor (sin
 * petición extra al cargar) y se actualiza con el refresco en tiempo real.
 * Abrirla marca como leídos los que había.
 */
export function NotificationBell({ initial, className }: { initial: BandejaNotificaciones; className?: string }) {
  const router = useRouter();
  const [bandeja, setBandeja] = useState(initial);
  useEffect(() => setBandeja(initial), [initial]);

  const onOpenChange = (open: boolean) => {
    const vistos = bandeja.items.filter((n) => !n.leidaAt).map((n) => n.id);
    if (!open || vistos.length === 0) return;
    // Al abrir: se ven como nuevos esta vez y quedan leídos para la siguiente.
    // Solo los que se están enseñando: uno que haya llegado después, o que no
    // quepa en la lista, sigue sin leer.
    void request("/notificaciones", { method: "PATCH", body: JSON.stringify({ ids: vistos }) })
      .then(() => router.refresh())
      .catch(() => undefined);
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-ring",
          className,
        )}
        aria-label={bandeja.sinLeer > 0 ? `Avisos: ${bandeja.sinLeer} sin leer` : "Avisos"}
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        {bandeja.sinLeer > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none text-primary-foreground tabular-nums">
            {bandeja.sinLeer > 9 ? "9+" : bandeja.sinLeer}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-(--size-popover) p-0">
        <p className="border-b border-border-muted px-3 py-2 text-xs font-medium text-muted-foreground">Avisos</p>
        {bandeja.items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tienes avisos.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border-muted overflow-y-auto">
            {bandeja.items.map((n) => {
              const body = (
                <>
                  <div className="flex items-start gap-2">
                    {!n.leidaAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Nuevo" />}
                    <p className={cn("min-w-0 flex-1 text-sm", n.leidaAt ? "text-foreground-secondary" : "font-medium text-foreground")}>
                      {n.titulo}
                    </p>
                  </div>
                  {n.cuerpo && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.cuerpo}</p>}
                  <p className="mt-1 text-2xs text-subtle">{hace(n.createdAt)}</p>
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="block px-3 py-2.5 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none">
                      {body}
                    </Link>
                  ) : (
                    <div className="px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
