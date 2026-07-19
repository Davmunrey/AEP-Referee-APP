import type {
  SupportTicketAttachment,
  TicketCategory,
  TicketStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Etiquetas legibles ──────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  incidencia: "Incidencia",
  mejora: "Mejora",
  duda: "Duda",
  otro: "Otro",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: "Abierto",
  en_progreso: "En progreso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

export const TICKET_STATUSES: TicketStatus[] = [
  "abierto",
  "en_progreso",
  "resuelto",
  "cerrado",
];

export const TICKET_CATEGORIES: TicketCategory[] = [
  "incidencia",
  "mejora",
  "duda",
  "otro",
];

// ── Fechas ──────────────────────────────────────────────────────────────────

/** Fecha corta legible (es-ES). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Fecha corta con hora — para el hilo de comentarios. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fecha relativa corta; a partir de una semana cae a la fecha absoluta. */
export function relativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return shortDate(iso);
}

// ── Insignias ───────────────────────────────────────────────────────────────

const CATEGORY_TONE: Record<TicketCategory, string> = {
  incidencia: "bg-destructive-muted text-destructive ring-destructive-border",
  mejora: "bg-info-muted text-info ring-info-border",
  duda: "bg-warning-muted text-warning ring-warning-border",
  otro: "bg-muted text-muted-foreground ring-border",
};

export function CategoryBadge({
  categoria,
  className,
}: {
  categoria: TicketCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        CATEGORY_TONE[categoria],
        className,
      )}
    >
      {CATEGORY_LABELS[categoria]}
    </span>
  );
}

const STATUS_TONE: Record<TicketStatus, string> = {
  // abierto=info · en_progreso=warning · resuelto=success · cerrado=muted
  abierto: "bg-info-muted text-info ring-info-border",
  en_progreso: "bg-warning-muted text-warning ring-warning-border",
  resuelto: "bg-success-muted text-success ring-success-border",
  cerrado: "bg-muted text-muted-foreground ring-border",
};

export function TicketStatusPill({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Miniaturas de adjuntos ──────────────────────────────────────────────────

/*
 * Se usa <img> nativo (no next/image) para todos los adjuntos: los `signedUrl`
 * son URLs firmadas y efímeras de Supabase Storage (dominio externo, caducan a
 * los pocos minutos). Registrarlas en `images` de next.config no aporta nada y
 * añade acoplamiento a un dominio cambiante. Regla del repo: se prefiere
 * next/image SALVO en dominios firmados efímeros, que es exactamente este caso.
 */

/** Imagen de un adjunto (dimensiona con `className`). Único punto con <img>. */
export function AttachmentImage({
  attachment,
  className,
}: {
  attachment: SupportTicketAttachment;
  className?: string;
}) {
  if (!attachment.signedUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signedUrl efímero de Supabase Storage
    <img
      src={attachment.signedUrl}
      alt={attachment.fileName}
      loading="lazy"
      className={className}
    />
  );
}

/** Miniatura cuadrada (10×10) de un adjunto. */
export function AttachmentThumb({
  attachment,
  className,
}: {
  attachment: SupportTicketAttachment;
  className?: string;
}) {
  return (
    <AttachmentImage
      attachment={attachment}
      className={cn("h-10 w-10 rounded object-cover", className)}
    />
  );
}
