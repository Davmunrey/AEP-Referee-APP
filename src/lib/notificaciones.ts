/** Avisos dentro de la aplicación (la campana). */

export type NotificacionTipo =
  | "convocatoria-nueva"
  | "convocatoria-cierra"
  | "zona-solicitada"
  | "zona-resuelta"
  | "designacion"
  | "designacion-rechazada"
  /** Un juez pide acceso al portal desde la pantalla de acceso. */
  | "acceso-solicitado";

export interface Notificacion {
  id: string;
  userId: string;
  tipo: NotificacionTipo;
  titulo: string;
  cuerpo?: string;
  href?: string;
  /** Evita repetir el mismo aviso a la misma persona. */
  clave?: string;
  createdAt: string;
  leidaAt?: string;
}

export type NuevaNotificacion = Omit<Notificacion, "id" | "createdAt" | "leidaAt">;

export interface BandejaNotificaciones {
  items: Notificacion[];
  sinLeer: number;
}
