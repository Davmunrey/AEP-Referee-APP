"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface TransferDialogShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  titleId?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}

export function TransferDialogShell({
  open,
  onClose,
  title,
  subtitle,
  titleId: titleIdProp,
  children,
  footer,
  maxWidthClass = "max-w-3xl",
}: TransferDialogShellProps) {
  const autoId = useId();
  const titleId = titleIdProp ?? `${autoId}-title`;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const root = panelRef.current;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables[0];
    first?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = focusables.indexOf(active!);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1]?.focus();
        }
      } else if (idx === focusables.length - 1) {
        e.preventDefault();
        focusables[0]?.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm",
        dialogOverlayEnter,
      )}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          // El panel entra como cualquier otro modal de la app. Antes usaba el
          // keyframe `transfer-enter`, que además duplicaba la entrada: el marco
          // y su contenido subían a la vez y el gesto se leía borroso. Ese
          // keyframe sigue siendo el de los pasos interiores, no el del marco.
          "flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-2xl border border-border-muted bg-card shadow-card",
          dialogPanelEnter,
          maxWidthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-muted px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-foreground-secondary sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">{children}</div>
        {footer ? (
          <div className="border-t border-border-muted px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
