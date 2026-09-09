import { describe, expect, it } from "vitest";
import {
  isClaimTravelResolved,
  RECEIPT_INCOMPLETE_HINT,
} from "@/lib/judge-compensation/readiness";

/**
 * «Comparte vehículo» exime del COBRO del kilometraje, no de anotarlo: el
 * alojamiento se decide por la distancia, y así lo dice el propio título de la
 * casilla en la pantalla de compensación.
 *
 * Los dos mensajes que explican por qué no se puede exportar el recibo decían
 * «introduce los km (o marca que comparte vehículo)». Quien seguía ese consejo
 * marcaba la casilla, no pasaba nada, y volvía a leer lo mismo.
 */

const base = { distanceKmRoundTrip: undefined, distanceKmOneWay: undefined } as const;

describe("qué desbloquea de verdad el recibo", () => {
  it("marcar «comparte vehículo» no basta: siguen faltando los km", () => {
    expect(isClaimTravelResolved({ ...base, travelMode: "shared_vehicle_passenger" })).toBe(false);
  });

  it("los km sí bastan, también para quien comparte vehículo", () => {
    expect(
      isClaimTravelResolved({
        travelMode: "shared_vehicle_passenger",
        distanceKmRoundTrip: 300,
        distanceKmOneWay: 150,
      }),
    ).toBe(true);
  });

  it("«sin desplazamiento» sí queda resuelto sin km: no hay viaje que medir", () => {
    expect(isClaimTravelResolved({ ...base, travelMode: "none" })).toBe(true);
  });
});

describe("y qué dicen los mensajes", () => {
  it("el aviso ya no manda marcar la casilla para desbloquear", () => {
    expect(RECEIPT_INCOMPLETE_HINT).not.toMatch(/o marca (que )?comparte/i);
    expect(RECEIPT_INCOMPLETE_HINT).toMatch(/introdúcelos/i);
  });

  it("y explica para qué siguen haciendo falta los km", () => {
    expect(RECEIPT_INCOMPLETE_HINT).toMatch(/alojamiento/i);
  });

  it("la ruta de exportación dice lo mismo que la pantalla", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/app/api/v1/competitions/[id]/compensation/[refereeId]/export/route.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/o marca comparte vehículo\) antes de exportar/);
    expect(src).toMatch(/exime del cobro del kilometraje/);
  });
});
