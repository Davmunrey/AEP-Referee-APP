import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { RefereeLevel } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  return jsonOk(await dataService.getPromotions(user));
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const body = await request.json();
  const refereeId = String(body.refereeId ?? "").trim();
  const toLevel = String(body.toLevel ?? "").trim() as RefereeLevel;
  const zona = String(body.zona ?? user.zona ?? "").trim();
  const motivo = body.motivo ? String(body.motivo).trim() : undefined;

  if (!refereeId || !toLevel || !zona) {
    return jsonError("refereeId, toLevel y zona son obligatorios", 400);
  }

  const req = await dataService.createPromotion({ refereeId, toLevel, zona, motivo });
  return jsonOk(req);
}
