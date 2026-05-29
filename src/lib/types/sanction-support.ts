export type SanctionStatus = "activa" | "cumplida" | "revocada";

export type SanctionDurationPreset =
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "custom";

export interface ZoneDelegate {
  id: string;
  nombre: string;
  email: string;
}

export interface SanctionDelegateNotify {
  delegates: ZoneDelegate[];
  mailtoUrl: string;
  notifiedAt?: string;
}
