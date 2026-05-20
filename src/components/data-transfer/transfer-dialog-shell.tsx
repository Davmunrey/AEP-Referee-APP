"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-3"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "transfer-enter flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-2xl border border-border-muted/80 bg-card/95 shadow-card backdrop-blur-md",
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
