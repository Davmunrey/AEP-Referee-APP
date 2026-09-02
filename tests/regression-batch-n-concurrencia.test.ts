import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { RosterSlotConflictError } from "@/lib/competitions/service-types";
import { getStore } from "@/server/store";
import {
  assignReferee,
  clearSlot,
  createCompetition,
  getRosterHistory,
  saveCompetitionTemplate,
} from "@/server/services/memory-competitions";
import { createReferee } from "@/server/services/memory-referees";
import type { RosterSession } from "@/lib/types";

// La tarima es el recurso más disputado de la aplicación: dos delegados
// revisando el mismo campeonato escriben sobre los mismos huecos. El upsert no
// miraba quién ocupaba el hueco, así que el segundo en llegar sustituía al
// juez del primero sin error, sin aviso y sin dejar rastro.

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
    nombre: "Copa de concurrencia",
    tipo: "AEP-2",
    fecha: "2027-05-01",
    fechaFin: "2027-05-01",
    sede: "Madrid",
    zona: "CENTRO",
    sesiones: 1,
    requeridos: 1,
  } as never);
  await saveCompetitionTemplate(comp.id, plantilla(), "Ana");

  const juezA = await createReferee({
    nombre: "Ana Pérez", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
  } as never);
  const juezB = await createReferee({
    nombre: "Bea López", zona: "CENTRO", nivel: "Nacional", estado: "Activo", disp: true,
  } as never);
  return { comp, juezA, juezB };
}

let ctx: Awaited<ReturnType<typeof escenario>>;

beforeEach(async () => {
  ctx = await escenario();
});

describe("dos usuarios sobre el mismo hueco", () => {
  it("el segundo no pisa al primero cuando declara lo que vio", async () => {
    // Los dos abren la tarima con el hueco vacío. El primero asigna; el
    // segundo, que sigue viendo el hueco libre, es rechazado.
    const primero = await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana", undefined, null);
    expect(primero.error).toBeUndefined();

    const segundo = await assignReferee(ctx.comp.id, SLOT, ctx.juezB.id, "Carlos", undefined, null);
    expect(segundo.conflict).toBe(true);
    expect(segundo.error).toContain("Ana Pérez");

    const store = getStore();
    expect(store.assignments.get(ctx.comp.id)?.[SLOT]).toBe(ctx.juezA.id);
  });

  it("sustituir a un juez sigue funcionando si se declara al ocupante", async () => {
    // El control es optimista, no un bloqueo: reemplazar es una operación
    // legítima mientras la pantalla esté al día.
    await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana", undefined, null);
    const cambio = await assignReferee(
      ctx.comp.id, SLOT, ctx.juezB.id, "Carlos", undefined, ctx.juezA.id,
    );
    expect(cambio.error).toBeUndefined();
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT]).toBe(ctx.juezB.id);
  });

  it("sin declarar nada se mantiene el comportamiento anterior", async () => {
    // Compatibilidad: un cliente que no envía el campo (la app móvil) no se
    // rompe, simplemente no obtiene la protección.
    await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana");
    const sinDeclarar = await assignReferee(ctx.comp.id, SLOT, ctx.juezB.id, "Carlos");
    expect(sinDeclarar.error).toBeUndefined();
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT]).toBe(ctx.juezB.id);
  });

  it("la sustitución deja constancia del juez desplazado", async () => {
    // Antes el historial solo decía a quién se asignaba: el desplazado
    // desaparecía sin rastro.
    await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana", undefined, null);
    await assignReferee(ctx.comp.id, SLOT, ctx.juezB.id, "Carlos", undefined, ctx.juezA.id);

    const historial = await getRosterHistory(ctx.comp.id);
    const sustitucion = historial.find((h) => h.detail?.includes("sustituye a"));
    expect(sustitucion?.detail).toContain(ctx.juezA.id);
  });
});

describe("liberar un hueco que otro acaba de cambiar", () => {
  it("rechaza el borrado cuando el ocupante ya no es el que se vio", async () => {
    await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana", undefined, null);
    // El segundo usuario vio el hueco vacío y pulsa «liberar».
    await expect(clearSlot(ctx.comp.id, SLOT, "Carlos", null)).rejects.toBeInstanceOf(
      RosterSlotConflictError,
    );
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT]).toBe(ctx.juezA.id);
  });

  it("libera cuando el ocupante coincide", async () => {
    await assignReferee(ctx.comp.id, SLOT, ctx.juezA.id, "Ana", undefined, null);
    await clearSlot(ctx.comp.id, SLOT, "Ana", ctx.juezA.id);
    expect(getStore().assignments.get(ctx.comp.id)?.[SLOT]).toBeUndefined();
  });
});
