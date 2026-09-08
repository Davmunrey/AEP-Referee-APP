import type { EventStatus } from "@/lib/types";

export interface CompensationHubItem {
  competitionId: string;
  nombre: string;
  fecha: string;
  fechaFin: string;
  sede: string;
  estado: EventStatus;
  judgeCount: number;
  venueReady: boolean;
  readyForExport: boolean;
  pendingKmCount: number;
  /** Suma de las liquidaciones ya completas (las exportables). */
  grandTotal: number;
  /** Suma de TODAS las liquidaciones, incluidas las que esperan km. */
  provisionalTotal: number;
  issueCount: number;
}

export interface CompensationHubSummary {
  items: CompensationHubItem[];
  totalPendingKm: number;
  readyCount: number;
  /** Dinero confirmado en todos los campeonatos listos para exportar. */
  confirmedTotal: number;
  /** Todo lo devengado, esté o no cerrado el kilometraje. */
  provisionalTotal: number;
}
