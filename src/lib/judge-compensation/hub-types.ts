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
  grandTotal: number;
  issueCount: number;
}

export interface CompensationHubSummary {
  items: CompensationHubItem[];
  totalPendingKm: number;
  readyCount: number;
}
