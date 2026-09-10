import { beforeEach, describe, expect, it } from "vitest";
import { getDashboard } from "@/server/services/memory-competitions";
import { getAnalytics } from "@/server/services/memory-analytics";
import { getStore } from "@/server/store";
import type { ActivityItem, ApprovalProposal, Competition, SessionUser } from "@/lib/types";

/**
 * Los dos últimos sitios donde una zona ilegible seguía abriendo la puerta.
 *
 * `zone-scope` separa los tres casos —sin restricción, una zona concreta, y
 * delegado de zona cuya zona NO se reconoce— justamente porque los dos últimos
 * caían juntos en `undefined`. En el backend en memoria quedaban dos usos de la
 * forma antigua:
 *
 *   - el registro de actividad del panel (`userZone ? filtrado : todo`), y
 *   - las propuestas de la analítica del año.
 *
 * En los dos, un delegado con la zona en blanco o ilegible leía las de todas
 * las zonas. El backend de producción ya usaba el criterio bueno en ambos
 * (`zoneScopeOf(user).kind === "all"` y `zoneVisibilityFilter`), así que dev y
 * producción contaban historias distintas.
 */

function competicion(id: string, nombre: string, zona: string): Competition {
  return {
    id,
    nombre,
    tipo: "AEP-2",
    fecha: "2026-03-14",
    fechaFin: "2026-03-15",
    sede: "Sede",
    sesiones: 2,
    requeridos: 6,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "",
    zona,
  };
}

function movimiento(evento: string): ActivityItem {
  return { tipo: "cambio", actor: "Alguien", accion: "editó", evento, hace: "ahora" };
}

function propuesta(id: string, zona: string): ApprovalProposal {
  return {
    id,
    competitionId: `evt-${id}`,
    competitionName: `Campeonato ${id}`,
    zona,
    submittedBy: "Delegado",
    submittedAt: "2026-03-01",
    status: "pendiente",
    assignments: {},
  };
}

function delegado(zona: string | undefined): SessionUser {
  return {
    id: "u-1",
    email: "delegado@aep.test",
    nombre: "Delegado",
    rol: "Delegado de Zona",
    iniciales: "DZ",
    role: "delegado_zona",
    zona,
  };
}

const SUPER_ADMIN: SessionUser = {
  id: "u-0",
  email: "admin@aep.test",
  nombre: "Admin",
  rol: "Super Admin",
  iniciales: "AD",
  role: "super_admin",
};

beforeEach(() => {
  const store = getStore();
  store.competitions.length = 0;
  store.competitions.push(
    competicion("evt-c", "Campeonato del Centro", "CENTRO"),
    competicion("evt-a", "Campeonato de Andalucía", "ANDALUCIA"),
  );
  store.activity.length = 0;
  store.activity.push(movimiento("Campeonato del Centro"), movimiento("Campeonato de Andalucía"));
  store.approvals.length = 0;
  store.approvals.push(propuesta("1", "CENTRO"), propuesta("2", "ANDALUCIA"));
});

describe("el registro de actividad del panel", () => {
  it("no se lo enseña entero a un delegado cuya zona no se reconoce", async () => {
    const panel = await getDashboard(delegado("Zona Inventada"));
    expect(panel.activity).toEqual([]);
  });

  it("ni a uno con la zona en blanco", async () => {
    const panel = await getDashboard(delegado(undefined));
    expect(panel.activity).toEqual([]);
  });

  it("el delegado con zona ve los movimientos de sus campeonatos", async () => {
    const panel = await getDashboard(delegado("CENTRO"));
    expect(panel.activity.map((a) => a.evento)).toEqual(["Campeonato del Centro"]);
  });

  it("y un super admin los ve todos", async () => {
    const panel = await getDashboard(SUPER_ADMIN);
    expect(panel.activity).toHaveLength(2);
  });
});

describe("las propuestas de la analítica", () => {
  it("no cuentan las de otras zonas para un delegado sin zona utilizable", async () => {
    const datos = await getAnalytics(delegado("Zona Inventada"), 2026);
    expect(datos.totals.pendingApprovals).toBe(0);
  });

  it("el delegado con zona cuenta solo las suyas", async () => {
    const datos = await getAnalytics(delegado("CENTRO"), 2026);
    expect(datos.totals.pendingApprovals).toBe(1);
  });

  it("y un super admin las cuenta todas", async () => {
    const datos = await getAnalytics(SUPER_ADMIN, 2026);
    expect(datos.totals.pendingApprovals).toBe(2);
  });
});
