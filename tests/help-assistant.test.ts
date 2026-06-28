import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_BASE,
  normalizeText,
  searchKnowledgeBase,
  tokenize,
} from "@/lib/help/knowledge-base";
import { quickStartForRole } from "@/lib/help/quick-start";

describe("normalizeText", () => {
  it("quita acentos, signos y mayúsculas", () => {
    expect(normalizeText("¿Cómo creo una TARIMA?")).toBe("como creo una tarima");
    expect(normalizeText("Aprobación/Ascenso")).toBe("aprobacion ascenso");
  });
});

describe("tokenize", () => {
  it("elimina stopwords y tokens cortos", () => {
    expect(tokenize("¿cómo recupero mi contraseña?")).toEqual(["recupero", "contrasena"]);
  });
});

describe("searchKnowledgeBase", () => {
  it("devuelve vacío para consulta vacía o solo stopwords", () => {
    expect(searchKnowledgeBase("")).toEqual([]);
    expect(searchKnowledgeBase("   ")).toEqual([]);
    expect(searchKnowledgeBase("de la que")).toEqual([]);
  });

  it("encuentra la recuperación de contraseña", () => {
    const top = searchKnowledgeBase("olvidé mi contraseña")[0];
    expect(top.entry.id).toBe("password-reset");
  });

  it("encuentra cómo construir la tarima", () => {
    const top = searchKnowledgeBase("construir la tarima cuadrante")[0];
    expect(top.entry.id).toBe("build-roster");
  });

  it("encuentra la asignación de un juez", () => {
    const top = searchKnowledgeBase("asignar un juez a una plaza")[0];
    expect(top.entry.id).toBe("assign-judge");
  });

  it("encuentra la pregunta de zona/permisos", () => {
    const top = searchKnowledgeBase("por qué no puedo editar otra zona")[0];
    expect(top.entry.id).toBe("roles-zones");
  });

  it("no devuelve resultados para consultas fuera de dominio", () => {
    expect(searchKnowledgeBase("receta de pizza con queso")).toEqual([]);
  });

  it("respeta el límite de resultados", () => {
    expect(searchKnowledgeBase("juez tarima aprobacion zona", undefined, 2).length).toBeLessThanOrEqual(2);
  });

  it("el rol relevante mejora la puntuación de su entrada", () => {
    const query = "enviar la tarima a aprobación";
    const withRole = searchKnowledgeBase(query, "delegado_zona").find(
      (r) => r.entry.id === "submit-approval",
    );
    const withoutRole = searchKnowledgeBase(query).find((r) => r.entry.id === "submit-approval");
    expect(withRole).toBeDefined();
    expect(withoutRole).toBeDefined();
    expect(withRole!.score).toBeGreaterThan(withoutRole!.score);
  });

  it("encuentra compensación para el rol financiero", () => {
    const top = searchKnowledgeBase("panel de compensación km recibos", "responsable_financiero_jueces")[0];
    expect(top.entry.id).toBe("compensation-hub");
  });

  it("encuentra normativa con cuatro pestañas", () => {
    const top = searchKnowledgeBase("normativa compensación baremo ipf")[0];
    expect(top.entry.id).toBe("regulations");
  });

  it("encuentra imprevisto en tarima aprobada", () => {
    const top = searchKnowledgeBase("tarima aprobada imprevisto")[0];
    expect(top.entry.id).toBe("roster-imprevisto");
  });

  it("todas las entradas tienen id único", () => {
    const ids = KNOWLEDGE_BASE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("la base de conocimiento cubre las áreas principales", () => {
    expect(KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(KNOWLEDGE_BASE.map((e) => e.id));
    expect(ids.has("compensation-hub")).toBe(true);
    expect(ids.has("roster-imprevisto")).toBe(true);
    expect(ids.has("regulations")).toBe(true);
  });
});

describe("quickStartForRole", () => {
  it("devuelve pasos para cada rol", () => {
    for (const role of [
      "super_admin",
      "delegado_jueces",
      "delegado_zona",
      "responsable_financiero_jueces",
      "solo_ver",
    ] as const) {
      const steps = quickStartForRole(role);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].title).toBeTruthy();
    }
  });

  it("el responsable financiero ve compensación y recibos", () => {
    const bodies = quickStartForRole("responsable_financiero_jueces")
      .map((s) => `${s.title} ${s.body}`.toLowerCase())
      .join(" ");
    expect(bodies).toContain("compensación");
    expect(bodies).toContain("iban");
  });

  it("el delegado de zona ve el flujo de construir y enviar la tarima", () => {
    const titles = quickStartForRole("delegado_zona").map((s) => s.title.toLowerCase());
    expect(titles.some((t) => t.includes("tarima"))).toBe(true);
    expect(titles.some((t) => t.includes("aprobación"))).toBe(true);
  });
});
