import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askGemini, isGeminiConfigured } from "@/server/assistant/gemini";

const ORIGINAL = { ...process.env };

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("isGeminiConfigured", () => {
  it("refleja la presencia de la clave", () => {
    expect(isGeminiConfigured()).toBe(true);
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);
  });
});

describe("askGemini", () => {
  it("lanza si no hay clave", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(askGemini("sys", [{ role: "user", text: "hola" }])).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it("devuelve el texto de la respuesta y llama al modelo por defecto", async () => {
    const fetchMock = mockFetch(200, {
      candidates: [{ content: { parts: [{ text: "Para crear una tarima…" }] } }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const reply = await askGemini("sys", [{ role: "user", text: "¿cómo creo una tarima?" }]);
    expect(reply).toBe("Para crear una tarima…");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("gemini-2.0-flash:generateContent");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("respeta GEMINI_MODEL", async () => {
    process.env.GEMINI_MODEL = "gemini-1.5-flash";
    const fetchMock = mockFetch(200, {
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });
    vi.stubGlobal("fetch", fetchMock);
    await askGemini("sys", [{ role: "user", text: "x" }]);
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-1.5-flash:generateContent");
  });

  it("incluye el motivo real del error de la API (p. ej. clave inválida)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(400, { error: { status: "INVALID_ARGUMENT", message: "API key not valid." } }),
    );
    await expect(askGemini("sys", [{ role: "user", text: "x" }])).rejects.toThrow(
      /API key not valid/,
    );
  });

  it("lanza ante respuesta vacía con el finishReason", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { candidates: [{ finishReason: "SAFETY" }] }));
    await expect(askGemini("sys", [{ role: "user", text: "x" }])).rejects.toThrow(/SAFETY/);
  });

  it("lanza si la respuesta fue bloqueada por seguridad (promptFeedback)", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { promptFeedback: { blockReason: "SAFETY" } }));
    await expect(askGemini("sys", [{ role: "user", text: "x" }])).rejects.toThrow(/seguridad/);
  });
});
