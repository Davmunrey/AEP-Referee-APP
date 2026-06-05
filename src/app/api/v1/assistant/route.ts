import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { canAskAssistant } from "@/lib/api/assistant-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { buildSystemPrompt } from "@/lib/help/assistant-prompt";
import { askGemini, isGeminiConfigured, type GeminiTurn } from "@/server/assistant/gemini";
import type { UserRole } from "@/lib/types";

const ROLES: readonly UserRole[] = [
  "super_admin",
  "delegado_jueces",
  "delegado_zona",
  "solo_ver",
];

interface AssistantBody {
  question?: unknown;
  history?: unknown;
}

/** Normaliza el historial recibido a turnos válidos para el modelo. */
function parseHistory(raw: unknown): GeminiTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-8)
    .map((m): GeminiTurn => ({
      role: (m as { role?: unknown })?.role === "model" ? "model" : "user",
      text:
        typeof (m as { text?: unknown })?.text === "string"
          ? ((m as { text: string }).text).slice(0, 2000)
          : "",
    }))
    .filter((m) => m.text.length > 0);
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  // Inerte sin clave: el cliente recurrirá al asistente local.
  if (!isGeminiConfigured()) {
    return jsonError("Asistente IA no configurado", 503, { code: "not_configured" });
  }

  const limit = canAskAssistant(user.id);
  if (!limit.allowed) {
    return jsonError("Demasiadas preguntas seguidas. Espera un momento.", 429);
  }

  const body = (await request.json().catch(() => null)) as AssistantBody | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) {
    return jsonError("Pregunta no válida", 400);
  }

  const role: UserRole = ROLES.includes(user.role) ? user.role : "solo_ver";

  const turns: GeminiTurn[] = [...parseHistory(body?.history), { role: "user", text: question }];
  // El primer turno debe ser de 'user'.
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();

  try {
    const reply = await askGemini(buildSystemPrompt(role), turns);
    return jsonOk({ reply });
  } catch {
    // No filtramos detalles del proveedor; el cliente hará fallback al local.
    return jsonError("El asistente no está disponible ahora mismo.", 502, {
      code: "upstream_error",
    });
  }
}
