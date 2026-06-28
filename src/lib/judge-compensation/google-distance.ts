import type { CompensationLocation } from "./types";

export interface DistanceMatrixResult {
  distanceKmOneWay: number;
  distanceMeters: number;
  durationSeconds?: number;
  source: "google_maps";
}

/**
 * Distancia en coche (km) vía Google Distance Matrix API.
 * Requiere `GOOGLE_MAPS_API_KEY` en servidor.
 */
export async function fetchDrivingDistanceKm(
  origin: CompensationLocation,
  destination: CompensationLocation,
): Promise<DistanceMatrixResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY no configurada");
  }
  if (
    origin.lat == null ||
    origin.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    throw new Error("Origen y destino requieren coordenadas (lat/lng)");
  }

  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    mode: "driving",
    language: "es",
    key: apiKey,
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Google Distance Matrix HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    rows?: { elements: { status: string; distance?: { value: number } }[] }[];
  };

  if (data.status !== "OK") {
    throw new Error(data.error_message ?? `Google API: ${data.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK" || !element.distance) {
    throw new Error("No se pudo calcular la ruta entre domicilio y sede");
  }

  const distanceMeters = element.distance.value;
  const distanceKmOneWay = Math.round((distanceMeters / 1000) * 10) / 10;

  return {
    distanceKmOneWay,
    distanceMeters,
    source: "google_maps",
  };
}

/** Geocodifica una dirección en español (servidor). */
export async function geocodeAddress(address: string): Promise<CompensationLocation> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY no configurada");
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Dirección vacía");

  const params = new URLSearchParams({
    address: trimmed,
    key: apiKey,
    language: "es",
    region: "es",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);

  const data = (await res.json()) as {
    status: string;
    results?: { geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error("No se encontró la dirección");
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { address: trimmed, lat, lng };
}
