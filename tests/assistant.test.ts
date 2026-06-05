import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildKnowledgeContext, buildSystemPrompt } from "@/lib/help/assistant-prompt";
import { __resetAssistantLimiter, canAskAssistant } from "@/lib/api/assistant-rate-limit";

describe("buildSystemPrompt", () => {
  it("incluye el rol, las reglas y la base de conocimiento", () => {
    const prompt = buildSystemPrompt("delegado_zona");
    expect(prompt).toContain("Delegado de Zona");
    expect(prompt).toContain("español");
    expect(prompt.toLowerCase()).toContain("tarima");
    // No debe pedir datos personales/credenciales.
    expect(prompt).toContain("No pidas ni reveles datos personales");
    // Debe prohibir los guiones largos en la respuesta.
    expect(prompt).toContain("guiones largos");
  });

  it("el contexto de conocimiento no está vacío", () => {
    expect(buildKnowledgeContext().length).toBeGreaterThan(200);
  });
});

describe("canAskAssistant", () => {
  beforeEach(() => __resetAssistantLimiter());

  it("permite hasta el máximo y luego bloquea", () => {
    let lastAllowed = true;
    for (let i = 0; i < 30; i++) {
      lastAllowed = canAskAssistant("user-a").allowed;
    }
    expect(lastAllowed).toBe(true);
    const blocked = canAskAssistant("user-a");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("cuenta por clave independiente", () => {
    for (let i = 0; i < 30; i++) canAskAssistant("user-b");
    expect(canAskAssistant("user-b").allowed).toBe(false);
    expect(canAskAssistant("user-c").allowed).toBe(true);
  });
});

// --- Ruta /api/v1/assistant (con Gemini mockeado) ---

const requireApiUser = vi.fn();
const isGeminiConfigured = vi.fn();
const askGemini = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/assistant/gemini", () => ({
  isGeminiConfigured: () => isGeminiConfigured(),
  askGemini: (s: string, t: unknown) => askGemini(s, t),
}));

import { POST } from "@/app/api/v1/assistant/route";

const postBody = (body: unknown) =>
  new Request("http://localhost/api/v1/assistant", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /api/v1/assistant", () => {
  beforeEach(() => {
    __resetAssistantLimiter();
    requireApiUser.mockReset();
    isGeminiConfigured.mockReset();
    askGemini.mockReset();
    requireApiUser.mockResolvedValue({ id: "u1", email: "a@b.c", role: "delegado_zona", nombre: "Z" });
    isGeminiConfigured.mockReturnValue(true);
    askGemini.mockResolvedValue("Para crear una tarima, abre el campeonato y asigna jueces.");
  });

  it("401 si no hay sesión", async () => {
    requireApiUser.mockResolvedValue(new Response(null, { status: 401 }));
    const res = await POST(postBody({ question: "hola" }));
    expect(res.status).toBe(401);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("503 si el asistente IA no está configurado", async () => {
    isGeminiConfigured.mockReturnValue(false);
    const res = await POST(postBody({ question: "¿cómo creo una tarima?" }));
    expect(res.status).toBe(503);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("400 si la pregunta falta o es demasiado larga", async () => {
    expect((await POST(postBody({}))).status).toBe(400);
    expect((await POST(postBody({ question: "x".repeat(1001) }))).status).toBe(400);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("200 devuelve la respuesta del modelo", async () => {
    const res = await POST(postBody({ question: "¿cómo creo una tarima?" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { reply: string } };
    expect(json.data.reply).toContain("tarima");
    expect(askGemini).toHaveBeenCalledTimes(1);
  });

  it("502 si el proveedor falla (cliente hará fallback local)", async () => {
    askGemini.mockRejectedValue(new Error("boom"));
    const res = await POST(postBody({ question: "¿cómo creo una tarima?" }));
    expect(res.status).toBe(502);
  });
});
