import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";
import { addDaysIso, todayIso } from "@/lib/business-date";
import type { RosterSession } from "@/lib/types";

// El panel de inicio enseñaba el mismo campeonato con dos coberturas: la
// previsión calculaba plantilla + asignaciones («15/45») y la tabla leía la
// copia guardada en la fila («5/9»). El indicador de plazas, además, contaba
// con `countOpenSlots` sin el respaldo de `requeridos`: un campeonato sin
// plantilla de 6 plazas sumaba 0 («30 plazas» frente a 15 + … = 36).

describe("indicadores del panel", () => {
  it("salen de la cobertura viva, incluido el respaldo de requeridos", () => {
    const kpis = buildDashboardKpis({
      coverage: [
        { open: 30, required: 45, estado: "Crítico" },
        // Sin plantilla: 6 plazas por `requeridos`.
        { open: 6, required: 6, estado: "Borrador" },
      ],
      referees: [{ estado: "Activo" }, { estado: "Baja" }],
      approvals: [{ status: "pendiente" }, { status: "aprobado" }],
    });
    const by = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(by.openSlots).toMatchObject({ value: "36", sub: "de 51 · 29 % cubierto", tone: "critical" });
    expect(by.upcoming).toMatchObject({ value: "2", sub: "1 en estado crítico" });
    expect(by.approvals).toMatchObject({ value: "1", sub: "espera revisión nacional", tone: "warning" });
    expect(by.referees).toMatchObject({ value: "1", sub: "de 2 federados", tone: "default" });
  });

  it("sin nada pendiente no hay color", () => {
    const kpis = buildDashboardKpis({ coverage: [], referees: [], approvals: [] });
    expect(kpis.every((k) => k.tone === "default")).toBe(true);
  });
});

// ── Supabase: la fila guardada va atrasada respecto a la tarima ─────────────
const fecha = addDaysIso(todayIso(), 30);
const template: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "",
    categorias: [],
    horarioCompeticion: "",
    horarioPesaje: "",
    roles: [{ rol: "Juez central", key: "central", slots: 2 }],
    pesajeRoles: [],
  },
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let select = "";
      const result = () => {
        if (table === "competitions" && select.includes("template")) {
          return { data: [{ id: "c1", template, tipo: "AEP-3" }], error: null };
        }
        if (table === "competitions") {
          return {
            data: [
              // Copia guardada atrasada: 5/9 «Completo».
              { id: "c1", nombre: "Open", tipo: "AEP-3", fecha, fecha_fin: fecha, sede: "X", sesiones: 1, requeridos: 9, confirmados: 9, estado: "Completo", aprobacion: "Sin propuesta", zona: "CENTRO" },
            ],
            error: null,
          };
        }
        if (table === "roster_assignments") {
          return { data: [{ competition_id: "c1", slot_key: "S1_central_0", referee_id: "r1" }], error: null };
        }
        return { data: [], error: null };
      };
      const q: Record<string, unknown> = {};
      for (const m of ["eq", "neq", "lt", "lte", "gt", "gte", "order", "limit", "is", "or", "not", "ilike", "contains", "in", "insert", "update", "upsert", "delete"]) q[m] = () => q;
      q.select = (cols?: string) => ((select = cols ?? ""), q);
      q.range = async () => result();
      q.single = async () => ({ data: null, error: null });
      q.maybeSingle = async () => ({ data: null, error: null });
      q.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return q;
    },
  }),
}));

import { analyticsService } from "@/server/services/supabase-analytics";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

describe("panel de inicio en Supabase", () => {
  it("lista, cobertura, indicadores y calendario dicen lo mismo del campeonato", async () => {
    const res = await analyticsService.getDashboard({
      id: "u", email: "a@b.es", nombre: "Admin", rol: "Super Admin", iniciales: "AD", role: "super_admin",
    });
    const [upcoming] = res.upcomingCompetitions;
    // 1 de 2 plazas de la plantilla, no la copia «9/9 Completo».
    expect(upcoming).toMatchObject({ id: "c1", confirmados: 1, requeridos: 2 });
    expect(upcoming!.estado).not.toBe("Completo");
    expect(res.coverage[0]).toMatchObject({ filled: 1, open: 1, required: 2, estado: upcoming!.estado });
    expect(res.kpis.find((k) => k.id === "openSlots")?.value).toBe("1");
    expect(res.calendar[fecha]?.[0]?.estado).toBe(upcoming!.estado);
  });
});
