import { beforeEach, describe, expect, it, vi } from "vitest";

const isApnsConfigured = vi.fn();
const sendApnsPush = vi.fn();
const deviceTokensForUsers = vi.fn();

vi.mock("@/server/notifications/apns", () => ({
  isApnsConfigured: () => isApnsConfigured(),
  sendApnsPush: (...args: unknown[]) => sendApnsPush(...args),
}));
vi.mock("@/server/notifications/device-tokens", () => ({
  deviceTokensForUsers: (ids: string[]) => deviceTokensForUsers(ids),
}));

let profileRows: Array<{ id: string }> | null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ in: () => ({ eq: async () => ({ data: profileRows, error: null }) }) }),
    }),
  }),
}));

import { approverUserIds, notifyUsers } from "@/server/notifications/notify";

const note = { title: "t", body: "b", type: "approval_pending" };

beforeEach(() => {
  isApnsConfigured.mockReset();
  sendApnsPush.mockReset();
  deviceTokensForUsers.mockReset();
  isApnsConfigured.mockReturnValue(true);
  sendApnsPush.mockResolvedValue([]);
  deviceTokensForUsers.mockResolvedValue([{ apnsToken: "tok", environment: "production" }]);
  profileRows = [{ id: "a1" }, { id: "a2" }];
});

describe("notifyUsers", () => {
  it("no hace nada si APNs no está configurado", async () => {
    isApnsConfigured.mockReturnValue(false);
    await notifyUsers(["u1"], note);
    expect(deviceTokensForUsers).not.toHaveBeenCalled();
    expect(sendApnsPush).not.toHaveBeenCalled();
  });

  it("no hace nada sin destinatarios", async () => {
    await notifyUsers([], note);
    expect(deviceTokensForUsers).not.toHaveBeenCalled();
  });

  it("no envía si los usuarios no tienen dispositivos registrados", async () => {
    deviceTokensForUsers.mockResolvedValue([]);
    await notifyUsers(["u1"], note);
    expect(sendApnsPush).not.toHaveBeenCalled();
  });

  it("envía a los dispositivos de los usuarios indicados", async () => {
    await notifyUsers(["u1"], note);
    expect(deviceTokensForUsers).toHaveBeenCalledWith(["u1"]);
    expect(sendApnsPush).toHaveBeenCalledWith(
      [{ apnsToken: "tok", environment: "production" }],
      note,
    );
  });

  it("nunca lanza aunque el envío falle", async () => {
    sendApnsPush.mockRejectedValue(new Error("APNs caído"));
    await expect(notifyUsers(["u1"], note)).resolves.toBeUndefined();
  });
});

describe("approverUserIds", () => {
  it("devuelve los IDs del comité nacional activos", async () => {
    expect(await approverUserIds()).toEqual(["a1", "a2"]);
  });

  it("devuelve [] ante error o sin datos", async () => {
    profileRows = null;
    expect(await approverUserIds()).toEqual([]);
  });
});
