import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Calcular la ruta de un juez guardaba, además de la distancia,
 * `travelMode: "km_rate"`. Para un juez que comparte vehículo eso es pasar a
 * cobrar el kilometraje —dinero— como efecto secundario de una consulta. Y los
 * km sí le hacen falta: el alojamiento se decide por la distancia.
 *
 * El cálculo en lote se salta a esos jueces a propósito, y el gemelo en
 * memoria no toca el modo: el gemelo de Supabase se había quedado solo.
 */

const getCompetition = vi.fn();
const getReferee = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        update: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      });
      return q;
    },
  }),
}));
vi.mock("@/server/services/supabase-competitions", () => ({
  competitionService: { getCompetition: (...a: unknown[]) => getCompetition(...a) },
}));
vi.mock("@/server/services/supabase-referees", () => ({
  refereeService: { getReferee: (...a: unknown[]) => getReferee(...a) },
}));
vi.mock("@/lib/judge-compensation/osm-distance", () => ({
  fetchDrivingDistanceKm: async () => ({ distanceKmOneWay: 120, distanceKmRoundTrip: 240 }),
  geocodeAddress: async () => {
    throw new Error("no debería geocodificar: las coordenadas ya están");
  },
  osmThrottle: async () => {},
}));

const { compensationService } = await import("@/server/services/supabase-compensation");

beforeEach(() => {
  vi.clearAllMocks();
  getCompetition.mockResolvedValue({
    id: "evt-1",
    sede: "Pabellón",
    sedeDireccion: "Calle Uno 1, Madrid",
    sedeLat: 40.4,
    sedeLng: -3.7,
  });
  getReferee.mockResolvedValue({
    id: "ref-1",
    domicilio: "Calle Dos 2, Toledo",
    domicilioLat: 39.86,
    domicilioLng: -4.02,
  });
});

describe("calcular la ruta de un juez", () => {
  it("guarda la distancia y no toca el modo de desplazamiento", async () => {
    const guardar = vi
      .spyOn(compensationService, "updateClaim")
      .mockResolvedValue({ id: "c-1" } as never);

    await compensationService.calculateDistance("evt-1", "ref-1");

    expect(guardar).toHaveBeenCalledTimes(1);
    const patch = guardar.mock.calls[0]![2] as Record<string, unknown>;
    expect(patch).toMatchObject({
      distanceKmOneWay: 120,
      distanceKmRoundTrip: 240,
      distanceSource: "osm",
    });
    expect("travelMode" in patch).toBe(false);
  });
});
