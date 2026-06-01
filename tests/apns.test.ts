import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  buildApnsPayload,
  buildProviderToken,
  getApnsConfig,
  isApnsConfigured,
  type ApnsConfig,
} from "@/server/notifications/apns";

// Clave EC P-256 de prueba (no es secreta; solo para firmar/verificar en test).
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const APNS_ENV = ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_BUNDLE_ID", "APNS_KEY_P8"];

afterEach(() => {
  for (const k of APNS_ENV) delete process.env[k];
});

function setApnsEnv(p8: string) {
  process.env.APNS_KEY_ID = "KEY123";
  process.env.APNS_TEAM_ID = "TEAM456";
  process.env.APNS_BUNDLE_ID = "es.aep.tarima";
  process.env.APNS_KEY_P8 = p8;
}

describe("getApnsConfig / isApnsConfigured", () => {
  it("null cuando faltan variables", () => {
    expect(getApnsConfig()).toBeNull();
    expect(isApnsConfigured()).toBe(false);
  });

  it("acepta el PEM tal cual", () => {
    setApnsEnv(privatePem);
    const cfg = getApnsConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(isApnsConfigured()).toBe(true);
  });

  it("decodifica el PEM si viene en base64", () => {
    setApnsEnv(Buffer.from(privatePem, "utf8").toString("base64"));
    expect(getApnsConfig()?.privateKeyPem).toContain("BEGIN PRIVATE KEY");
  });
});

describe("buildProviderToken", () => {
  const config: ApnsConfig = {
    keyId: "KEY123",
    teamId: "TEAM456",
    bundleId: "es.aep.tarima",
    privateKeyPem: privatePem,
  };

  it("produce un JWT ES256 firmado y verificable con la clave pública", () => {
    const now = 1_900_000_000_000;
    const jwt = buildProviderToken(config, now);
    const [h, c, sig] = jwt.split(".");
    expect(sig).toBeTruthy();

    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
    expect(header).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(claims).toEqual({ iss: "TEAM456", iat: Math.floor(now / 1000) });

    const valid = verify(
      "sha256",
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(sig, "base64url"),
    );
    expect(valid).toBe(true);
  });
});

describe("buildApnsPayload", () => {
  it("incluye alert, type y datos extra al nivel raíz", () => {
    const payload = buildApnsPayload({
      title: "Tarima pendiente",
      body: "Revisa la propuesta",
      type: "approval_pending",
      data: { competitionId: "c1" },
      threadId: "approvals",
    });
    expect(payload).toMatchObject({
      aps: { alert: { title: "Tarima pendiente", body: "Revisa la propuesta" }, sound: "default", "thread-id": "approvals" },
      type: "approval_pending",
      competitionId: "c1",
    });
  });

  it("añade badge solo cuando se indica", () => {
    expect(buildApnsPayload({ title: "t", body: "b", type: "x" }).aps).not.toHaveProperty("badge");
    const withBadge = buildApnsPayload({ title: "t", body: "b", type: "x", badge: 3 });
    expect((withBadge.aps as Record<string, unknown>).badge).toBe(3);
  });
});
