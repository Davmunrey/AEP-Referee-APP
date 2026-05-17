import { jsonError } from "@/lib/api/route-utils";
import type { SessionUser } from "@/lib/types";
import { dataService } from "@/server/services";

/** 403 si delegado_zona intenta actuar fuera de su zona. */
export async function assertRefereeInUserZone(
  user: SessionUser,
  refereeId: string,
): Promise<Response | null> {
  if (user.role !== "delegado_zona" || !user.zona) return null;
  const referee = await dataService.getReferee(refereeId);
  if (!referee || referee.zona !== user.zona) {
    return jsonError("Sin permiso para este juez", 403);
  }
  return null;
}
