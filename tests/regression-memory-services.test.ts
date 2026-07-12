import { beforeEach, describe, expect, it } from "vitest";
import type { Referee, SessionUser } from "@/lib/types";

// El servicio en memoria solo se usa sin Supabase configurado.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { getStore } from "@/server/store";
import {
  createCompetition,
  deleteCompetition,
} from "@/server/services/memory-competitions";
import { createExam, getExams } from "@/server/services/memory-admin";

function resetStore() {
  const s = getStore();
  s.competitions.length = 0;
  s.referees.length = 0;
  s.exams.length = 0;
  s.assignments.clear();
  s.slotFlags.clear();
  s.templates.clear();
}

const baseComp = {
  nombre: "Camp",
  tipo: "AEP-2" as const,
  fecha: "2026-05-01",
  fechaFin: "2026-05-02",
  sede: "Madrid",
  sesiones: 2,
  requeridos: 8,
  zona: "CENTRO",
};

beforeEach(resetStore);

describe("createCompetition — ids únicos tras un borrado intermedio", () => {
  it("no reutiliza el id de una competición existente", async () => {
    const a = await createCompetition({ ...baseComp, nombre: "A" });
    const b = await createCompetition({ ...baseComp, nombre: "B" });
    const c = await createCompetition({ ...baseComp, nombre: "C" });
    expect([a.id, b.id, c.id]).toEqual(["evt-001", "evt-002", "evt-003"]);

    await deleteCompetition(b.id); // borra el intermedio
    const d = await createCompetition({ ...baseComp, nombre: "D" });

    // Antes: length(2)+1 = "evt-003" → colisión con C. Ahora: max+1 = "evt-004".
    expect(d.id).toBe("evt-004");
    expect(getStore().competitions.map((x) => x.id)).toContain("evt-003");
    expect(new Set(getStore().competitions.map((x) => x.id)).size).toBe(3);
  });
});

describe("getExams — filtro de zona canonicaliza etiquetas sin normalizar", () => {
  it("un delegado de zona ve exámenes de un juez con zona en formato de import", async () => {
    const referee: Referee = {
      id: "j001",
      nombre: "Juez Centro",
      zona: "2- CENTRO", // etiqueta cruda tal cual la deja un import
      nivel: "Regional",
      estado: "Activo",
      eventos: 0,
      ultimo: "—",
      disp: true,
      iniciales: "JC",
    };
    getStore().referees.push(referee);
    await createExam({
      refereeId: "j001",
      tipo: "Nuevo juez",
      nivelObjetivo: "Regional",
      fecha: "2026-04-01",
      examinador: "Examinador",
    });

    const delegado = { role: "delegado_zona", zona: "CENTRO" } as SessionUser;
    const exams = await getExams(undefined, delegado);
    // Antes: "2- CENTRO" === "CENTRO" era false → examen oculto al delegado.
    expect(exams).toHaveLength(1);
    expect(exams[0]?.refereeId).toBe("j001");
  });
});
