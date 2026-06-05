/**
 * Cliente del asistente IA con Google Gemini (capa gratuita). La API key se lee
 * SIEMPRE del entorno del servidor (`GEMINI_API_KEY`): nunca se expone al
 * cliente ni se almacena en el repositorio. Si falta la clave, el asistente IA
 * queda inerte y el cliente recurre al asistente local.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 15_000;

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

/** ¿Hay clave configurada? */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Pregunta a Gemini con un prompt de sistema (anclaje) y el historial de turnos.
 * Lanza si la clave falta o la API responde con error.
 */
export async function askGemini(systemPrompt: string, turns: GeminiTurn[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key, // en cabecera, no en la URL (evita que la clave aparezca en logs)
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      generationConfig: { temperature: 0.3, topP: 0.9, maxOutputTokens: 512 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // Capturamos el motivo real (p. ej. API_KEY_INVALID, modelo no encontrado,
    // cuota agotada) para poder diagnosticarlo en los logs del servidor.
    const detail = await res
      .json()
      .then((b: { error?: { message?: string; status?: string } }) =>
        b?.error?.message ? `${b.error.status ?? ""} ${b.error.message}`.trim() : "",
      )
      .catch(() => "");
    throw new Error(`Gemini ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Bloqueado por seguridad: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(`Respuesta vacía de Gemini${reason ? ` (finishReason: ${reason})` : ""}`);
  }
  return text;
}
