import { beforeEach, describe, expect, it } from "vitest";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { CompetitionHasClaimsError } from "@/lib/competitions/service-types";
import { getStore } from "@/server/store";
import {
  createCompetition,
  deleteCompetition,
  removeDuplicateCompetitions,
} from "@/server/services/memory-competitions";

// `judge_compensation_claims.competition_id` nació con ON DELETE CASCADE, así
// que borrar un campeonato se llevaba por delante sus liquidaciones, incluidas
// las que ya estaban en `pagado`. Y no hacía falta pulsar «Eliminar»: la
// importación de calendario deduplica sola y el criterio de qué copia conservar
// solo mira la tarima, no el dinero.

type ClaimStore = Map<string, { competitionId: string; status: string }>;

function claimsStore(): ClaimStore {
  const g = globalThis as unknown as { __aepCompensationStore?: ClaimStore };
  return (g.__aepCompensationStore ??= new Map());
}

const base = {
  tipo: "AEP-2" as const,
  fecha: "2026-05-01",
  fechaFin: "2026-05-02",
  sede: "Madrid",
  zona: "CENTRO",
  sesiones: 1,
};

beforeEach(() => {
  claimsStore().clear();
  const store = getStore();
  store.competitions.length = 0;
});

describe("borrado de campeonatos con liquidaciones", () => {
  it("se niega a borrar un campeonato que tiene liquidaciones", async () => {
    const comp = await createCompetition({ ...base, nombre: "Copa con dietas" });
    claimsStore().set("c1", { competitionId: comp.id, status: "pagado" });

    await expect(deleteCompetition(comp.id)).rejects.toBeInstanceOf(CompetitionHasClaimsError);
    expect(getStore().competitions.some((c) => c.id === comp.id)).toBe(true);
  });

  it("borra con normalidad si no hay liquidaciones", async () => {
    const comp = await createCompetition({ ...base, nombre: "Copa sin dietas" });
    await expect(deleteCompetition(comp.id)).resolves.toBe(true);
    expect(getStore().competitions.some((c) => c.id === comp.id)).toBe(false);
  });

  it("la deduplicación conserva el duplicado que tiene el dinero", async () => {
    // Dos copias del mismo campeonato: el deduplicador elige superviviente por
    // tarima, así que puede marcar para borrar justo la que tiene las dietas.
    const a = await createCompetition({ ...base, nombre: "Copa Duplicada" });
    const b = await createCompetition({ ...base, nombre: "Copa Duplicada" });
    const marcado = [a, b].sort((x, y) => x.id.localeCompare(y.id))[1]!;
    claimsStore().set("c1", { competitionId: marcado.id, status: "pagado" });

    const res = await removeDuplicateCompetitions();

    expect(res.removed).not.toContain(marcado.id);
    expect(getStore().competitions.some((c) => c.id === marcado.id)).toBe(true);
  });
});
