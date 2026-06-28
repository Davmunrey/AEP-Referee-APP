import { revalidatePath } from "next/cache";
import { resolveZoneCode } from "@/lib/aep-zones";
import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { geocodeAddress } from "@/lib/judge-compensation/osm-distance";
import type { CompensationClubContact } from "@/lib/judge-compensation/types";
import { normalizeClubEmails } from "@/lib/organizer-clubs";
import { dataService } from "@/server/services";
import type { Competition, EventType } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const scopeError = await assertCompetitionInUserZone(user, id);
  if (scopeError) return scopeError;
  const competition = await dataService.getCompetition(id);
  if (!competition) return jsonError("Competición no encontrada", 404);
  return jsonOk(competition);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }

  const competition = await dataService.getCompetition(id);
  if (!competition) return jsonError("Competición no encontrada", 404);

  // Un delegado de zona solo puede editar competiciones de SU zona
  // y no puede reasignar la competición a otra zona.
  if (user.role === "delegado_zona") {
    const userZone = resolveZoneCode(user.zona ?? "") ?? user.zona;
    const compZone = resolveZoneCode(competition.zona ?? "") ?? competition.zona;
    if (!user.zona || compZone !== userZone) return jsonError("Sin permiso", 403);
    if (
      body.zona !== undefined &&
      (resolveZoneCode(String(body.zona)) ?? body.zona) !== userZone
    ) {
      return jsonError("No puedes mover competiciones a otra zona", 403);
    }
  }

  // Lista blanca: solo campos editables del campeonato. Nunca `aprobacion`,
  // `estado`, `confirmados` ni `template` (los gestiona el flujo de roster/aprobación).
  const patch: Partial<Competition> = {};
  if (typeof body.nombre === "string") patch.nombre = body.nombre;
  if (typeof body.tipo === "string") patch.tipo = body.tipo as EventType;
  if (typeof body.fecha === "string") patch.fecha = body.fecha;
  if (typeof body.fechaFin === "string") patch.fechaFin = body.fechaFin;
  if (typeof body.sede === "string") patch.sede = body.sede;
  if (typeof body.zona === "string") patch.zona = body.zona;
  if (typeof body.sesiones === "number") patch.sesiones = body.sesiones;
  if (typeof body.requeridos === "number") patch.requeridos = body.requeridos;

  if (canManageCompensation(user)) {
    if (body.compensationOrganizer === "club" || body.compensationOrganizer === "aep") {
      patch.compensationOrganizer = body.compensationOrganizer;
    }
    if (typeof body.compensationClubName === "string") {
      patch.compensationClubName = body.compensationClubName;
    }
    if (typeof body.compensationClubEmail === "string") {
      patch.compensationClubEmail = body.compensationClubEmail;
    }
    if (typeof body.compensationVolunteer === "boolean") {
      patch.compensationVolunteer = body.compensationVolunteer;
    }
    if (Array.isArray(body.compensationClubs)) {
      patch.compensationClubs = body.compensationClubs
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return null;
          const rec = item as Record<string, unknown>;
          const name = typeof rec.name === "string" ? rec.name.trim() : "";
          const emails =
            typeof rec.emails === "string"
              ? normalizeClubEmails(rec.emails)
              : Array.isArray(rec.emails)
                ? rec.emails.map((e) => String(e).trim()).filter((e) => e.includes("@"))
                : [];
          if (!name) return null;
          return { name, emails } satisfies CompensationClubContact;
        })
        .filter(Boolean) as CompensationClubContact[];
    }
    if (typeof body.sedeDireccion === "string") {
      patch.sedeDireccion = body.sedeDireccion;
      const trimmed = body.sedeDireccion.trim();
      if (!trimmed) {
        patch.sedeLat = undefined;
        patch.sedeLng = undefined;
      } else if (
        typeof body.sedeLat === "number" &&
        typeof body.sedeLng === "number" &&
        Number.isFinite(body.sedeLat) &&
        Number.isFinite(body.sedeLng)
      ) {
        patch.sedeLat = body.sedeLat;
        patch.sedeLng = body.sedeLng;
      } else {
        try {
          const geo = await geocodeAddress(trimmed);
          patch.sedeLat = geo.lat;
          patch.sedeLng = geo.lng;
        } catch {
          return jsonError("No se pudo geocodificar la sede. Revisa la dirección o elige una sugerencia de la lista.", 422);
        }
      }
    }
    if (body.ambito === "epf" || body.ambito === "ipf" || body.ambito === null) {
      patch.ambito = body.ambito ?? undefined;
    }
  }

  const updated = await dataService.updateCompetition(id, patch);
  if (!updated) return jsonError("Competición no encontrada", 404);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const competition = await dataService.getCompetition(id);
  if (!competition) return jsonError("Competición no encontrada", 404);
  if (user.role === "delegado_zona" && competition.zona !== user.zona)
    return jsonError("Sin permiso", 403);

  const ok = await dataService.deleteCompetition(id);
  if (!ok) return jsonError("No se pudo eliminar el campeonato en la base de datos", 500);
  revalidatePath("/competitions");
  revalidatePath("/");
  revalidatePath(`/competitions/${id}`);
  return jsonOk({ deleted: true });
}
