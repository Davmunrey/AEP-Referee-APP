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

/**
 * Tope de espera para los servicios externos de OpenStreetMap.
 *
 * `fetch` no tiene timeout por defecto: un upstream lento dejaba la petición
 * colgada hasta que la plataforma mataba la función, y el usuario veía el
 * spinner y luego un fallo sin explicación. Con el corte, el error llega a
 * tiempo y dice qué pasó.
 */
const OSM_TIMEOUT_MS = 8000;

function osmTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(OSM_TIMEOUT_MS);
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export interface DistanceMatrixResult {
  distanceKmOneWay: number;
  /** Ida+vuelta redondeado UNA sola vez desde los metros reales (base de facturación). */
  distanceKmRoundTrip: number;
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

  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
      headers: { "User-Agent": APP_USER_AGENT, Accept: "application/json" },
      next: { revalidate: 0 },
      signal: osmTimeoutSignal(),
    });
  } catch (err) {
    if (isTimeout(err)) {
      throw new Error(
        "El buscador de direcciones (OpenStreetMap) no respondió a tiempo. Inténtalo de nuevo.",
      );
    }
    throw err;
  }

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

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: osmTimeoutSignal(),
    });
  } catch (err) {
    if (isTimeout(err)) {
      throw new Error(
        "El cálculo de ruta (OpenStreetMap) no respondió a tiempo. Inténtalo de nuevo o introduce los km a mano.",
      );
    }
    throw err;
  }

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
  // El i+v se redondea directamente sobre los metros reales (×2) para no arrastrar
  // el error de redondear la ida a km enteros y luego duplicar. La ida se mantiene
  // redondeada solo para mostrarla.
  const distanceKmOneWay = Math.round(distanceMeters / 1000);
  const distanceKmRoundTrip = Math.round((distanceMeters * 2) / 1000);

  return {
    distanceKmOneWay,
    distanceKmRoundTrip,
    distanceMeters,
    durationSeconds: data.routes[0].duration,
    source: "osm",
  };
}
