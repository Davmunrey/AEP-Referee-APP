import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { RefereeHasClaimsError } from "@/lib/competitions/service-types";
import { getStore } from "@/server/store";
import { createReferee, deleteReferee } from "@/server/services/memory-referees";

// `judge_compensation_claims.referee_id` es ON DELETE CASCADE (024:17), igual
// que la del campeonato: borrar la ficha de un juez se llevaba por delante sus
// liquidaciones, incluidas las que ya estaban en `pagado`. El campeonato ya
// estaba protegido; el juez no.

type ClaimStore = Map<string, { refereeId: string; status: string }>;

function claimsStore(): ClaimStore {
  const g = globalThis as unknown as { __aepCompensationStore?: ClaimStore };
  return (g.__aepCompensationStore ??= new Map());
}

beforeEach(() => {
  claimsStore().clear();
  getStore().referees.length = 0;
});

async function nuevoJuez() {
  return createReferee({
    nombre: "Ana Pérez",
    zona: "CENTRO",
    nivel: "Nacional",
    estado: "Activo",
    disp: true,
  } as never);
}

describe("deleteReferee — protección de liquidaciones", () => {
  it("no borra al juez que tiene una liquidación pagada", async () => {
    const juez = await nuevoJuez();
    claimsStore().set("cmp-1", { refereeId: juez.id, status: "pagado" });

    await expect(deleteReferee(juez.id)).rejects.toBeInstanceOf(RefereeHasClaimsError);
    expect(getStore().referees).toHaveLength(1);
  });

  it("el mensaje concuerda en singular y en plural", async () => {
    const juez = await nuevoJuez();
    claimsStore().set("cmp-1", { refereeId: juez.id, status: "pagado" });
    await expect(deleteReferee(juez.id)).rejects.toThrow(/1 liquidación de dietas asociada/);

    claimsStore().set("cmp-2", { refereeId: juez.id, status: "borrador" });
    await expect(deleteReferee(juez.id)).rejects.toThrow(/2 liquidaciones de dietas asociadas/);
  });

  it("la liquidación de otro juez no bloquea el borrado", async () => {
    const juez = await nuevoJuez();
    claimsStore().set("cmp-1", { refereeId: "otro-juez", status: "pagado" });

    await expect(deleteReferee(juez.id)).resolves.toBe(true);
    expect(getStore().referees).toHaveLength(0);
  });

  it("un juez inexistente sigue devolviendo false, no un error", async () => {
    await expect(deleteReferee("ref-404")).resolves.toBe(false);
  });
});
