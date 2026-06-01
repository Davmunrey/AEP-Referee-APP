import http2 from "node:http2";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

/**
 * Cliente APNs (token-based, HTTP/2) para emitir notificaciones push a la app
 * iOS nativa. Inerte si no está configurado: sin las variables APNS_* todas
 * las funciones de envío son no-ops, de modo que web y dev no se ven afectados.
 *
 * Variables de entorno requeridas (servidor):
 *   APNS_KEY_ID    — Key ID de la clave .p8 (App Store Connect).
 *   APNS_TEAM_ID   — Team ID de la cuenta de desarrollador.
 *   APNS_BUNDLE_ID — Bundle id de la app (apns-topic).
 *   APNS_KEY_P8    — Contenido de la clave .p8 (PEM, o el PEM en base64).
 */

export type ApnsEnvironment = "sandbox" | "production";

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyPem: string;
}

export interface ApnsTarget {
  apnsToken: string;
  environment: ApnsEnvironment;
}

export interface ApnsNotification {
  title: string;
  body: string;
  /** Tipo lógico para enrutar el deep-link en el cliente. */
  type: string;
  /** Datos extra (ids para navegar). */
  data?: Record<string, string>;
  badge?: number;
  threadId?: string;
}

export interface ApnsSendResult {
  apnsToken: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

const HOSTS: Record<ApnsEnvironment, string> = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

export function getApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const raw = process.env.APNS_KEY_P8;
  if (!keyId || !teamId || !bundleId || !raw) return null;

  // Acepta el PEM tal cual (con \n literales o reales) o codificado en base64.
  const privateKeyPem = raw.includes("BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8");

  return { keyId, teamId, bundleId, privateKeyPem };
}

export function isApnsConfigured(): boolean {
  return getApnsConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Construye el provider token JWT (ES256) que firma las peticiones a APNs. */
export function buildProviderToken(config: ApnsConfig, now: number = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) }));
  const signingInput = `${header}.${claims}`;
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(config.privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

// El provider token es reutilizable; Apple exige refrescarlo entre 20 y 60 min.
let cachedToken: { jwt: string; issuedAt: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000;

function providerToken(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedToken && now - cachedToken.issuedAt < TOKEN_TTL_MS) return cachedToken.jwt;
  const jwt = buildProviderToken(config, now);
  cachedToken = { jwt, issuedAt: now };
  return jwt;
}

/** Cuerpo de la notificación en el formato que espera APNs. */
export function buildApnsPayload(n: ApnsNotification): Record<string, unknown> {
  return {
    aps: {
      alert: { title: n.title, body: n.body },
      sound: "default",
      ...(typeof n.badge === "number" ? { badge: n.badge } : {}),
      ...(n.threadId ? { "thread-id": n.threadId } : {}),
    },
    type: n.type,
    ...(n.data ?? {}),
  };
}

function sendOne(
  session: http2.ClientHttp2Session,
  deviceToken: string,
  providerJwt: string,
  topic: string,
  body: Buffer,
): Promise<ApnsSendResult> {
  return new Promise((resolve) => {
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerJwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "content-type": "application/json",
      "content-length": body.length,
    });
    let status = 0;
    let data = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      const ok = status === 200;
      let reason: string | undefined;
      if (!ok && data) {
        try {
          reason = JSON.parse(data).reason;
        } catch {
          reason = data.slice(0, 200);
        }
      }
      resolve({ apnsToken: deviceToken, ok, status, reason });
    });
    req.on("error", (err) => resolve({ apnsToken: deviceToken, ok: false, reason: err.message }));
    req.end(body);
  });
}

/**
 * Envía una notificación a una lista de dispositivos. No lanza: si APNs no
 * está configurado o no hay destinatarios, devuelve []. Agrupa por entorno
 * (sandbox/production) y reutiliza una sesión HTTP/2 por host.
 */
export async function sendApnsPush(
  targets: ApnsTarget[],
  notification: ApnsNotification,
): Promise<ApnsSendResult[]> {
  const config = getApnsConfig();
  if (!config || targets.length === 0) return [];

  const jwt = providerToken(config);
  const body = Buffer.from(JSON.stringify(buildApnsPayload(notification)));

  const byEnv = new Map<ApnsEnvironment, string[]>();
  for (const t of targets) {
    const list = byEnv.get(t.environment) ?? [];
    list.push(t.apnsToken);
    byEnv.set(t.environment, list);
  }

  const results: ApnsSendResult[] = [];
  for (const [env, tokens] of byEnv) {
    const session = http2.connect(HOSTS[env]);
    try {
      const batch = await Promise.all(
        tokens.map((deviceToken) => sendOne(session, deviceToken, jwt, config.bundleId, body)),
      );
      results.push(...batch);
    } finally {
      session.close();
    }
  }
  return results;
}
