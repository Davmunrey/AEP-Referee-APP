import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDrivingDistanceKm, geocodeAddress } from "@/lib/judge-compensation/osm-distance";
import { searchPhotonAddresses } from "@/lib/geocoding/photon-search";

function timeoutError(): Error {
  const err = new Error("The operation was aborted due to timeout");
  err.name = "TimeoutError";
  return err;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("los servicios externos de OpenStreetMap no pueden colgar la petición", () => {
  // `fetch` no lleva timeout por defecto: un upstream lento dejaba la función
  // colgada hasta que la plataforma la mataba, y el usuario veía el spinner y
  // después un fallo sin explicación.
  it("geocodificar pasa un AbortSignal", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => [{ lat: "40.4", lon: "-3.7", display_name: "Madrid" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await geocodeAddress("Calle Mayor 1, Madrid");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("si el buscador de direcciones no responde, lo dice en claro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw timeoutError(); }));
    await expect(geocodeAddress("Calle Mayor 1, Madrid")).rejects.toThrow(
      /no respondió a tiempo/,
    );
  });

  it("si el cálculo de ruta no responde, sugiere meter los km a mano", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw timeoutError(); }));
    await expect(
      fetchDrivingDistanceKm({ lat: 40.4, lng: -3.7 }, { lat: 41.4, lng: 2.2 }),
    ).rejects.toThrow(/introduce los km a mano/);
  });

  it("un error que no es de timeout se propaga tal cual", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    await expect(geocodeAddress("Calle Mayor 1, Madrid")).rejects.toThrow(/ECONNREFUSED/);
  });

  it("el autocompletado del domicilio también lleva tope", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ features: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await searchPhotonAddresses("Calle Mayor");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
