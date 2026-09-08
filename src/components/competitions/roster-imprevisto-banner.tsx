"use client";

import { AlertTriangle, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isRosterImprevistoMode,
  isRosterLockedByApproval,
  isRosterPendingApproval,
  isRosterRejected,
} from "@/lib/roster-coverage";

/** Fecha corta y legible; si no es una fecha utilizable, se devuelve tal cual. */
function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Resolución de la última propuesta, para poder explicar un rechazo. */
export interface RosterLastReview {
  status: string;
  comment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface RosterImprevistoBannerProps {
  aprobacion: string;
  canEdit: boolean;
  pending: boolean;
  lastReview?: RosterLastReview;
  onUnlock: () => void;
}

export function RosterImprevistoBanner({
  aprobacion,
  canEdit,
  pending,
  lastReview,
  onUnlock,
}: RosterImprevistoBannerProps) {
  // El rechazo obliga al revisor a escribir un motivo, pero ese motivo se
  // quedaba en la bandeja de aprobaciones: en la tarima solo aparecía la
  // palabra «Rechazado», sin decir qué había que corregir.
  if (isRosterRejected(aprobacion) && lastReview?.status === "rechazado") {
    return (
      <div className="border-b border-destructive-border bg-destructive-muted px-4 py-2.5">
        <p className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Propuesta <strong>rechazada</strong>
            {lastReview.reviewedBy ? ` por ${lastReview.reviewedBy}` : ""}
            {lastReview.reviewedAt ? ` · ${formatReviewDate(lastReview.reviewedAt)}` : ""}
            {lastReview.comment ? (
              <>
                {": "}
                <span className="font-medium">{lastReview.comment}</span>
              </>
            ) : (
              " (sin comentario)"
            )}
            . Corrige la tarima y vuelve a enviarla a aprobación.
          </span>
        </p>
      </div>
    );
  }

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

  // Con propuesta pendiente la tarima queda congelada para que el snapshot que
  // se aprobará no pueda divergir. Retirar la propuesta es la salida: sin ella,
  // la zona quedaría bloqueada hasta que un delegado nacional decidiera.
  if (isRosterPendingApproval(aprobacion) && canEdit) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-border bg-warning-subtle px-4 py-2.5">
        <p className="flex items-start gap-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta tarima está <strong>pendiente de aprobación</strong> y no se puede modificar: lo que
            se apruebe será exactamente lo que enviaste. Si necesitas cambiarla, retira la propuesta.
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
          Retirar propuesta
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
