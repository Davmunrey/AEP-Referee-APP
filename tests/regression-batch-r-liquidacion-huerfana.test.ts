import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { getStore } from "@/server/store";
import {
  assignReferee,
  clearSlot,
  createCompetition,
  saveCompetitionTemplate,
} from "@/server/services/memory-competitions";
import { createReferee } from "@/server/services/memory-referees";
import { memoryCompensationService } from "@/server/services/memory-compensation";
import type { RosterSession } from "@/lib/types";

// Traspaso tarima → compensación. El resumen recorría SOLO los jueces
// asignados en ese momento, así que una liquidación guardada cuyo juez salía
// de la tarima después —una sustitución— desaparecía de la pantalla y del
// total, incluido el dinero ya marcado como pagado.

const SLOT = "S1_central_0";

function plantilla(): RosterSession[] {
  return [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Sábado",
      categorias: [{ genero: "Hombres", pesos: "-74" }],
      horarioCompeticion: "10:00 - 13:00",
      horarioPesaje: "08:00 - 09:30",
      roles: [{ key: "central", rol: "Central", slots: 1 }],
      pesajeRoles: [],
    },
  ];
}

async function escenario() {
  const store = getStore();
  store.competitions.length = 0;
  store.referees.length = 0;
  store.assignments.clear();
  store.slotFlags.clear();
  store.history.length = 0;

  const comp = await createCompetition({
    nombre: "Copa de sustituciones",
    tipo: "AEP-2",
    fecha: "2027-05-01",
    fechaFin: "2027-05-01",
    sede: "Madrid",
    zona: "CENTRO",
    sesiones: 1,
    requeridos: 1,
  } as never);
  await saveCompetitionTemplate(comp.id, plantilla(), "Ana");

  const juez = await createReferee({
    nombre: "Ana Pérez", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
  } as never);
  await assignReferee(comp.id, SLOT, juez.id, "Ana", undefined, null);

  // Guardar la liquidación es lo que persiste la fila.
  await memoryCompensationService.updateClaim(comp.id, juez.id, {
    distanceKmRoundTrip: 200,
    status: "pagado",
  });
  return { comp, juez };
}

let ctx: Awaited<ReturnType<typeof escenario>>;

beforeEach(async () => {
  ctx = await escenario();
});

describe("liquidación de un juez que sale de la tarima", () => {
  it("sigue apareciendo, marcada, en vez de desaparecer", async () => {
    const antes = await memoryCompensationService.getSummary(ctx.comp.id);
    expect(antes.claims).toHaveLength(1);
    expect(antes.claims[0]?.offRoster).toBeFalsy();

    await clearSlot(ctx.comp.id, SLOT, "Carlos", ctx.juez.id);

    const despues = await memoryCompensationService.getSummary(ctx.comp.id);
    expect(despues.claims).toHaveLength(1);
    expect(despues.claims[0]?.offRoster).toBe(true);
    expect(despues.claims[0]?.status).toBe("pagado");
  });

  it("su importe no se cae del total", async () => {
    const antes = await memoryCompensationService.getSummary(ctx.comp.id);
    await clearSlot(ctx.comp.id, SLOT, "Carlos", ctx.juez.id);
    const despues = await memoryCompensationService.getSummary(ctx.comp.id);

    expect(antes.grandTotal).toBeGreaterThan(0);
    expect(despues.grandTotal).toBe(antes.grandTotal);
  });

  it("una tarima vaciada del todo no esconde lo ya liquidado", async () => {
    // El resumen cortaba antes de mirar el almacén cuando no quedaba nadie
    // asignado.
    await clearSlot(ctx.comp.id, SLOT, "Carlos", ctx.juez.id);
    const resumen = await memoryCompensationService.getSummary(ctx.comp.id);
    expect(resumen.claims.map((c) => c.refereeName)).toEqual(["Ana Pérez"]);
  });

  it("volver a asignar al juez la devuelve a la tarima sin duplicarla", async () => {
    await clearSlot(ctx.comp.id, SLOT, "Carlos", ctx.juez.id);
    await assignReferee(ctx.comp.id, SLOT, ctx.juez.id, "Carlos", undefined, null);

    const resumen = await memoryCompensationService.getSummary(ctx.comp.id);
    expect(resumen.claims).toHaveLength(1);
    expect(resumen.claims[0]?.offRoster).toBeFalsy();
  });

  it("no bloquea la exportación de quienes sí están en la tarima", async () => {
    // Una liquidación huérfana con km pendientes no puede impedir enviar los
    // recibos del roster vigente.
    const otro = await createReferee({
      nombre: "Bea López", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
    } as never);
    await clearSlot(ctx.comp.id, SLOT, "Carlos", ctx.juez.id);
    await assignReferee(ctx.comp.id, SLOT, otro.id, "Carlos", undefined, null);
    await memoryCompensationService.updateClaim(ctx.comp.id, otro.id, {
      distanceKmRoundTrip: 100,
    });

    const resumen = await memoryCompensationService.getSummary(ctx.comp.id);
    expect(resumen.claims.some((c) => c.offRoster)).toBe(true);
    expect(resumen.readiness.pendingTravelReferees).toEqual([]);
  });
});
