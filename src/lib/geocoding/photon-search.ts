/** Búsqueda de direcciones vía Photon (OpenStreetMap) — solo servidor. */

export interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

/** Bounding box aproximado de España (lon min, lat min, lon max, lat max). */
const SPAIN_BBOX = "-9.5,36.0,3.3,43.8";

export function formatPhotonAddress(feature: PhotonFeature): string {
  const p = feature.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const city = p.city ?? p.town ?? p.village ?? "";
  const parts = [p.name, street, city, p.state, p.postcode, p.country].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

/** Busca sugerencias de dirección en España. Photon no admite lang=es (solo default/de/en/fr). */
export async function searchPhotonAddresses(
  query: string,
  limit = 6,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    limit: String(limit),
    bbox: SPAIN_BBOX,
  });

  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);

  const data = (await res.json()) as { features?: PhotonFeature[] };
  if (!Array.isArray(data.features)) return [];

  return data.features
    // Photon devuelve ocasionalmente features sin geometría (límites
    // administrativos); sin este filtro, uno solo tumbaba la búsqueda entera.
    .filter((feature) => Array.isArray(feature.geometry?.coordinates) && feature.geometry.coordinates.length >= 2)
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return {
        address: formatPhotonAddress(feature),
        lat,
        lng,
      };
    });
}
