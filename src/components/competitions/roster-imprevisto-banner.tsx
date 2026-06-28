"use client";

import { AlertTriangle, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRosterImprevistoMode, isRosterLockedByApproval } from "@/lib/roster-coverage";

interface RosterImprevistoBannerProps {
  aprobacion: string;
  canEdit: boolean;
  pending: boolean;
  onUnlock: () => void;
}

export function RosterImprevistoBanner({
  aprobacion,
  canEdit,
  pending,
  onUnlock,
}: RosterImprevistoBannerProps) {
  if (isRosterLockedByApproval(aprobacion) && canEdit) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-border bg-warning-subtle px-4 py-2.5">
        <p className="flex items-start gap-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta tarima está <strong>aprobada</strong>. Si surge un imprevisto (baja de última hora,
            cambio de juez, etc.), regístralo para desbloquear edición y reenviar a aprobación.
          </span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 border-warning-border text-xs"
          disabled={pending}
          onClick={onUnlock}
        >
          <Unlock className="h-3.5 w-3.5" />
          Registrar imprevisto
        </Button>
      </div>
    );
  }

  if (isRosterImprevistoMode(aprobacion)) {
    return (
      <div className="border-b border-warning-border bg-warning-subtle/60 px-4 py-2">
        <p className="flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Modo <strong>imprevisto</strong> activo: puedes modificar la tarima. Cuando termines, envía de
          nuevo a aprobación.
        </p>
      </div>
    );
  }

  return null;
}
