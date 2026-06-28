import type { CompensationLocation } from "./types";

const NOMINATIM_URL =
  process.env.NOMINATIM_URL?.replace(/\/$/, "") ?? "https://nominatim.openstreetmap.org";
const OSRM_URL = process.env.OSRM_URL?.replace(/\/$/, "") ?? "https://router.project-osrm.org";
const APP_USER_AGENT =
  process.env.OSM_USER_AGENT ?? "AEP-Tarima/1.0 (https://aep-tarima.vercel.app; powerhispania@gmail.com)";

/** Pausa entre peticiones a Nominatim (política de uso justo: ~1 req/s). */
export function osmThrottle(ms = 1100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DistanceMatrixResult {
  distanceKmOneWay: number;
  distanceMeters: number;
  durationSeconds?: number;
  source: "osm";
}

/** Geocodifica una dirección con Nominatim (OpenStreetMap, gratuito). */
export async function geocodeAddress(address: string): Promise<CompensationLocation> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Dirección vacía");

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "1",
    countrycodes: "es",
    addressdetails: "0",
  });

  const res = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
    headers: { "User-Agent": APP_USER_AGENT, Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  const hit = data[0];
  if (!hit) throw new Error("No se encontró la dirección en OpenStreetMap");

  return {
    address: hit.display_name ?? trimmed,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
  };
}

/** Distancia en coche (km) vía OSRM sobre datos OpenStreetMap (gratuito). */
export async function fetchDrivingDistanceKm(
  origin: CompensationLocation,
  destination: CompensationLocation,
): Promise<DistanceMatrixResult> {
  if (
    origin.lat == null ||
    origin.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    throw new Error("Origen y destino requieren coordenadas (lat/lng)");
  }

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=false&alternatives=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number }[];
    message?: string;
  };

  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(data.message ?? "No se pudo calcular la ruta entre domicilio y sede");
  }

  const distanceMeters = data.routes[0].distance;
  const distanceKmOneWay = Math.round(distanceMeters / 1000);

  return {
    distanceKmOneWay,
    distanceMeters,
    durationSeconds: data.routes[0].duration,
    source: "osm",
  };
}
