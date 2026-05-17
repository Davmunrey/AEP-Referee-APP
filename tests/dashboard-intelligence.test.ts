import { describe, it, expect } from "vitest";
import {
  buildIntelligence,
  daysUntil,
  type IntelligenceInput,
} from "@/lib/dashboard-intelligence";
import type { EventCoverage } from "@/lib/types";

const NOW = new Date(2026, 4, 17); // 2026-05-17, local time

/** Returns an ISO date string `offset` days from NOW. */
function dateFromNow(offset: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function coverage(over: Partial<EventCoverage> = {}): EventCoverage {
  return {
    id: "e1",
    nombre: "Evento",
    fecha: dateFromNow(60),
    estado: "Completo",
    filled: 6,
    open: 0,
    required: 6,
    ...over,
  };
}

function emptyInput(over: Partial<IntelligenceInput> = {}): IntelligenceInput {
  return {
    referees: [],
    competitions: [],
    approvals: [],
    promotions: [],
    coverage: [],
    activity: [],
    ...over,
  };
}

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    expect(daysUntil(dateFromNow(0), NOW)).toBe(0);
  });

  it("returns positive count for future dates", () => {
    expect(daysUntil(dateFromNow(10), NOW)).toBe(10);
  });

  it("returns negative count for past dates", () => {
    expect(daysUntil(dateFromNow(-5), NOW)).toBe(-5);
  });

  it("returns null for an invalid date string", () => {
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });

  it("ignores time-of-day, comparing calendar days only", () => {
    const now = new Date(2026, 4, 17, 23, 59);
    expect(daysUntil("2026-05-18", now)).toBe(1);
  });
});

describe("buildIntelligence — health score", () => {
  it("scores a fully healthy operation as óptimo", () => {
    const input = emptyInput({
      referees: [
        { estado: "Activo" },
        { estado: "Activo" },
        { estado: "Activo" },
      ],
      coverage: [coverage({ filled: 6, open: 0, required: 6 })],
      approvals: [],
    });
    const { health } = buildIntelligence(input, NOW);
    expect(health.score).toBe(100);
    expect(health.status).toBe("óptimo");
    expect(health.summary).toContain("óptima");
  });

  it("returns score 100 / óptimo for completely empty input (no data = no penalty)", () => {
    const { health } = buildIntelligence(emptyInput(), NOW);
    expect(health.score).toBe(100);
    expect(health.status).toBe("óptimo");
    expect(health.factors).toHaveLength(5);
  });

  it("factor weights sum to 1.0", () => {
    const { health } = buildIntelligence(emptyInput(), NOW);
    const sum = health.factors.reduce((a, f) => a + f.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("drives score to crítico when everything is bad", () => {
    const input = emptyInput({
      referees: [
        { estado: "Inactivo" },
        { estado: "Inactivo" },
        { estado: "Inactivo" },
      ],
      coverage: [
        coverage({
          id: "c1",
          estado: "Crítico",
          filled: 0,
          open: 6,
          required: 6,
          fecha: dateFromNow(5),
        }),
      ],
      approvals: Array.from({ length: 8 }, () => ({ status: "pendiente" })),
    });
    const { health } = buildIntelligence(input, NOW);
    expect(health.score).toBeLessThan(50);
    expect(health.status).toBe("crítico");
    expect(health.summary).toContain("punto débil");
  });

  it("computes coverage factor from filled/required ratio", () => {
    const input = emptyInput({
      coverage: [coverage({ filled: 3, open: 3, required: 6 })],
    });
    const { health } = buildIntelligence(input, NOW);
    const cov = health.factors.find((f) => f.label === "Cobertura de plantillas");
    expect(cov?.score).toBe(50);
    expect(cov?.detail).toBe("3/6 plazas asignadas");
  });

  it("penalizes the approvals backlog factor (14 points per pending)", () => {
    const input = emptyInput({
      approvals: [{ status: "pendiente" }, { status: "pendiente" }],
    });
    const { health } = buildIntelligence(input, NOW);
    const backlog = health.factors.find((f) => f.label === "Cola de aprobaciones");
    expect(backlog?.score).toBe(100 - 2 * 14);
  });

  it("penalizes urgency for open slots in events within 21 days", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "soon", open: 2, filled: 4, required: 6, fecha: dateFromNow(10) }),
      ],
    });
    const { health } = buildIntelligence(input, NOW);
    const urgency = health.factors.find((f) => f.label === "Urgencia operativa");
    expect(urgency?.score).toBe(100 - 2 * 8);
  });

  it("does not penalize urgency for open slots beyond 21 days", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "far", open: 5, filled: 1, required: 6, fecha: dateFromNow(60) }),
      ],
    });
    const { health } = buildIntelligence(input, NOW);
    const urgency = health.factors.find((f) => f.label === "Urgencia operativa");
    expect(urgency?.score).toBe(100);
  });

  it("maps status thresholds correctly (estable, atención)", () => {
    // 85+ óptimo, 70-84 estable, 50-69 atención, <50 crítico.
    // Coverage factor has weight 0.34; the other four factors stay at 100.
    // filled 2/6 -> coverage 33 -> overall 33*0.34 + 100*0.66 ≈ 77 -> estable.
    const estable = buildIntelligence(
      emptyInput({ coverage: [coverage({ filled: 2, open: 4, required: 6 })] }),
      NOW,
    );
    expect(estable.health.status).toBe("estable");

    // filled 0/6 -> coverage 0 -> overall ≈ 66 -> atención.
    const atencion = buildIntelligence(
      emptyInput({ coverage: [coverage({ filled: 0, open: 6, required: 6 })] }),
      NOW,
    );
    expect(atencion.health.status).toBe("atención");
  });
});

describe("buildIntelligence — insights", () => {
  it("emits an 'all-clear' ok insight when nothing is wrong", () => {
    const { insights } = buildIntelligence(emptyInput(), NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("all-clear");
    expect(insights[0].severity).toBe("ok");
  });

  it("ranks crítico insights before alerta and sugerencia", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "crit", estado: "Crítico", open: 4, filled: 2, fecha: dateFromNow(3) }),
        coverage({ id: "soon", estado: "Incompleto", open: 2, filled: 4, fecha: dateFromNow(10) }),
      ],
      promotions: [{ status: "pendiente" }],
    });
    const { insights } = buildIntelligence(input, NOW);
    const ranks = insights.map((i) => i.severity);
    const order = { crítico: 0, alerta: 1, sugerencia: 2, ok: 3 } as const;
    for (let i = 1; i < ranks.length; i++) {
      expect(order[ranks[i]]).toBeGreaterThanOrEqual(order[ranks[i - 1]]);
    }
    expect(insights[0].severity).toBe("crítico");
  });

  it("does not emit 'all-clear' when a crítico or alerta insight exists", () => {
    const input = emptyInput({
      coverage: [coverage({ id: "crit", estado: "Crítico", open: 3, filled: 3 })],
    });
    const { insights } = buildIntelligence(input, NOW);
    expect(insights.some((i) => i.id === "all-clear")).toBe(false);
  });

  it("escalates approvals backlog to alerta at 4+ pending", () => {
    const four = buildIntelligence(
      emptyInput({ approvals: Array.from({ length: 4 }, () => ({ status: "pendiente" })) }),
      NOW,
    );
    const backlog = four.insights.find((i) => i.id === "approvals-backlog");
    expect(backlog?.severity).toBe("alerta");

    const three = buildIntelligence(
      emptyInput({ approvals: Array.from({ length: 3 }, () => ({ status: "pendiente" })) }),
      NOW,
    );
    const backlog3 = three.insights.find((i) => i.id === "approvals-backlog");
    expect(backlog3?.severity).toBe("sugerencia");
  });

  it("flags low availability below 65% active referees", () => {
    const input = emptyInput({
      referees: [
        { estado: "Activo" },
        { estado: "Inactivo" },
        { estado: "Inactivo" },
      ],
    });
    const { insights } = buildIntelligence(input, NOW);
    const low = insights.find((i) => i.id === "low-availability");
    expect(low).toBeDefined();
    expect(low?.severity).toBe("alerta");
    expect(low?.metric).toBe("33%");
  });

  it("does not flag low availability at exactly 65%+ active", () => {
    const input = emptyInput({
      referees: [
        { estado: "Activo" },
        { estado: "Activo" },
        { estado: "Inactivo" },
      ],
    });
    const { insights } = buildIntelligence(input, NOW);
    expect(insights.some((i) => i.id === "low-availability")).toBe(false);
  });

  it("caps the insight list at 6 entries", () => {
    const coverages: EventCoverage[] = Array.from({ length: 10 }, (_, i) =>
      coverage({
        id: `crit-${i}`,
        nombre: `Evento ${i}`,
        estado: "Crítico",
        open: 3,
        filled: 3,
        fecha: dateFromNow(5),
      }),
    );
    const { insights } = buildIntelligence(emptyInput({ coverage: coverages }), NOW);
    expect(insights).toHaveLength(6);
  });

  it("uses singular noun wording for an event one day away with one open slot", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "tom", estado: "Incompleto", open: 1, filled: 5, fecha: dateFromNow(1) }),
      ],
    });
    const { insights } = buildIntelligence(input, NOW);
    const soon = insights.find((i) => i.id === "soon-tom");
    // "día" (singular) and "plaza" (singular noun) — verb stays "quedan".
    expect(soon?.detail).toContain("Faltan 1 día ");
    expect(soon?.detail).toContain("1 plaza ");
    expect(soon?.detail).not.toContain("plazas");
  });

  it("uses plural noun wording for multiple open slots", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "multi", estado: "Incompleto", open: 3, filled: 3, fecha: dateFromNow(5) }),
      ],
    });
    const { insights } = buildIntelligence(input, NOW);
    const soon = insights.find((i) => i.id === "soon-multi");
    expect(soon?.detail).toContain("3 plazas ");
  });

  it("ignores past-dated events for the imminent-event insight", () => {
    const input = emptyInput({
      coverage: [
        coverage({ id: "past", estado: "Incompleto", open: 2, filled: 4, fecha: dateFromNow(-3) }),
      ],
    });
    const { insights } = buildIntelligence(input, NOW);
    expect(insights.some((i) => i.id === "soon-past")).toBe(false);
  });
});
