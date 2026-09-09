import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDrivingDistanceKm, geocodeAddress } from "@/lib/judge-compensation/osm-distance";
import { searchPhotonAddresses } from "@/lib/geocoding/photon-search";

/**
 * Todo lo que sostiene los kilómetros de un recibo llega de tres servicios
 * ajenos —Photon, Nominatim, OSRM— sobre los que la aplicación no manda nada.
 * Lo que devuelven no siempre son números: a veces es texto vacío, a veces
 * falta el campo. Y `Number("")` da 0, que en kilómetros significa «no hay
 * viaje que pagar», una respuesta perfectamente creíble.
 */

const fetchOriginal = globalThis.fetch;

function responde(payload: unknown, ok = true, status = 200) {
  const stub = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
  })) as unknown as typeof globalThis.fetch;
  globalThis.fetch = stub;
  return stub;
}

const MADRID = { address: "Madrid", lat: 40.4, lng: -3.7 };
const VALENCIA = { address: "Valencia", lat: 39.47, lng: -0.38 };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("coordenadas que llegan de Nominatim", () => {
  it("una latitud vacía no es el ecuador: se rechaza", async () => {
    responde([{ lat: "", lon: "-3.7", display_name: "Sitio" }]);
    await expect(geocodeAddress("Calle Mayor 1")).rejects.toThrow(/coordenadas ilegibles/i);
  });

  it("una latitud sin sentido tampoco pasa", async () => {
    responde([{ lat: "sin dato", lon: "-3.7" }]);
    await expect(geocodeAddress("Calle Mayor 1")).rejects.toThrow(/coordenadas ilegibles/i);
  });

  it("una latitud fuera del planeta se rechaza", async () => {
    responde([{ lat: "913.2", lon: "-3.7" }]);
    await expect(geocodeAddress("Calle Mayor 1")).rejects.toThrow(/coordenadas ilegibles/i);
  });

  it("una dirección normal sigue geocodificándose", async () => {
    responde([{ lat: "40.4168", lon: "-3.7038", display_name: "Madrid, España" }]);
    await expect(geocodeAddress("Puerta del Sol")).resolves.toEqual({
      address: "Madrid, España",
      lat: 40.4168,
      lng: -3.7038,
    });
  });
});

describe("la ruta que devuelve OSRM", () => {
  it("un NaN guardado en la ficha ya no llega a la URL", async () => {
    // El guardián comparaba con `null`, y `NaN == null` es falso: la petición
    // salía con «NaN,NaN» y volvía como un error incomprensible.
    const stub = responde({ code: "Ok", routes: [{ distance: 1000, duration: 60 }] });
    await expect(
      fetchDrivingDistanceKm({ address: "x", lat: Number.NaN, lng: -3.7 }, VALENCIA),
    ).rejects.toThrow(/coordenadas/i);
    expect(stub).not.toHaveBeenCalled();
  });

  it("una ruta sin distancia no son cero kilómetros", async () => {
    responde({ code: "Ok", routes: [{ distance: null, duration: 60 }] });
    await expect(fetchDrivingDistanceKm(MADRID, VALENCIA)).rejects.toThrow(/ilegible/i);
  });

  it("una distancia negativa tampoco se acepta", async () => {
    responde({ code: "Ok", routes: [{ distance: -5, duration: 60 }] });
    await expect(fetchDrivingDistanceKm(MADRID, VALENCIA)).rejects.toThrow(/ilegible/i);
  });

  it("el mensaje de error menciona la ruta, que es lo que la ruta HTTP convierte en 422", () => {
    // El manejador de /compensation/[refereeId]/distance decide entre 422 y 500
    // buscando estas palabras en el mensaje.
    const patron = /dirección|OpenStreetMap|coordenadas|ruta|Nominatim|OSRM/i;
    expect("El cálculo de ruta devolvió una distancia ilegible. Introduce los km a mano.").toMatch(patron);
    expect("OpenStreetMap devolvió coordenadas ilegibles para esa dirección").toMatch(patron);
    expect("Origen y destino requieren coordenadas (lat/lng) válidas").toMatch(patron);
  });

  it("una ruta normal redondea el ida y vuelta una sola vez", async () => {
    responde({ code: "Ok", routes: [{ distance: 351_600, duration: 12_000 }] });
    const r = await fetchDrivingDistanceKm(MADRID, VALENCIA);
    expect(r.distanceKmOneWay).toBe(352);
    expect(r.distanceKmRoundTrip).toBe(703);
  });
});

describe("sugerencias de dirección de Photon", () => {
  it("no se ofrece una sugerencia cuyas coordenadas no sirven", async () => {
    responde({
      features: [
        { properties: { name: "Buena" }, geometry: { coordinates: [-3.7, 40.4] } },
        { properties: { name: "Rota" }, geometry: { coordinates: [null, 40.4] } },
        { properties: { name: "Imposible" }, geometry: { coordinates: [-3.7, 900] } },
      ],
    });
    const out = await searchPhotonAddresses("Calle Mayor");
    expect(out).toEqual([{ address: "Buena", lat: 40.4, lng: -3.7 }]);
  });

  it("una sugerencia sin texto no se ofrece: no se puede ni leer ni elegir", async () => {
    responde({
      features: [{ properties: {}, geometry: { coordinates: [-3.7, 40.4] } }],
    });
    await expect(searchPhotonAddresses("Calle Mayor")).resolves.toEqual([]);
  });
});
