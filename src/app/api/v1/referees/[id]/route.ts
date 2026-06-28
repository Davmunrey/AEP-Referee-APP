import { resolveZoneCode } from "@/lib/aep-zones";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { geocodeAddress } from "@/lib/judge-compensation/google-distance";
import { dataService } from "@/server/services";
import type { Referee } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await context.params;
  const scopeErr = await assertRefereeInUserZone(user, id);
  if (scopeErr) return scopeErr;
  const referee = await dataService.getReferee(id);
  if (!referee) return jsonError("Juez no encontrado", 404);
  return jsonOk(referee);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const existing = await dataService.getReferee(id);
  if (!existing) return jsonError("Juez no encontrado", 404);

  // delegado_zona: solo puede editar jueces de su propia zona y no puede
  // moverlos a otra zona distinta de la suya.
  if (user.role === "delegado_zona") {
    if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
    const userZone = resolveZoneCode(user.zona) ?? user.zona;
    const refZone = resolveZoneCode(existing.zona) ?? existing.zona;
    if (refZone !== userZone) {
      return jsonError("Solo puedes editar jueces de tu zona", 403);
    }
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  // Lista blanca de campos editables — nunca `id` ni `iniciales` (derivado).
  const patch: Partial<Referee> = {};
  if (typeof raw.nombre === "string") patch.nombre = raw.nombre;
  if (typeof raw.zona === "string") patch.zona = raw.zona;
  if (typeof raw.nivel === "string") patch.nivel = raw.nivel as Referee["nivel"];
  if (typeof raw.estado === "string") {
    if (raw.estado === "Sancionado") {
      return jsonError(
        "Para sancionar usa el panel «Sanciones» en la ficha del juez",
        400,
      );
    }
    patch.estado = raw.estado as Referee["estado"];
  }
  if (typeof raw.eventos === "number") patch.eventos = raw.eventos;
  if (typeof raw.ultimo === "string") patch.ultimo = raw.ultimo;
  if (typeof raw.disp === "boolean") patch.disp = raw.disp;
  if (typeof raw.email === "string") patch.email = raw.email;
  if (typeof raw.licencia === "string") patch.licencia = raw.licencia;
  if (typeof raw.localidad === "string") patch.localidad = raw.localidad;
  if (typeof raw.telefono === "string") patch.telefono = raw.telefono;
  if (typeof raw.genero === "string") patch.genero = raw.genero;
  if (typeof raw.antiguedad === "string") patch.antiguedad = raw.antiguedad;
  if (typeof raw.notas === "string") patch.notas = raw.notas;
  if (typeof raw.ultimoFecha === "string") patch.ultimoFecha = raw.ultimoFecha;
  if (typeof raw.domicilio === "string") patch.domicilio = raw.domicilio;

  if (typeof raw.domicilio === "string") {
    const trimmed = raw.domicilio.trim();
    if (!trimmed) {
      patch.domicilioLat = undefined;
      patch.domicilioLng = undefined;
    } else if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const geo = await geocodeAddress(trimmed);
        patch.domicilioLat = geo.lat;
        patch.domicilioLng = geo.lng;
      } catch {
        return jsonError("No se pudo geocodificar el domicilio. Revisa la dirección.", 422);
      }
    }
  }

  if (user.role === "delegado_zona" && typeof patch.zona === "string") {
    const userZone = resolveZoneCode(user.zona) ?? user.zona;
    const targetZone = resolveZoneCode(patch.zona) ?? patch.zona;
    if (targetZone !== userZone) {
      return jsonError("No puedes mover jueces a otra zona", 403);
    }
  }

  // Una sanción activa no se puede levantar con este PATCH (ponerlo Activo o
  // disponible): hay que revocarla desde el panel de sanciones.
  if (patch.estado === "Activo" || patch.disp === true) {
    const activeSanction = await dataService.getActiveSanction(id);
    if (activeSanction) {
      return jsonError(
        "El juez tiene una sanción activa. Revócala desde el panel «Sanciones» para reactivarlo",
        409,
      );
    }
  }

  const updated = await dataService.updateReferee(id, patch);
  if (!updated) return jsonError("Juez no encontrado", 404);
  return jsonOk(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role !== "super_admin" && user.role !== "delegado_jueces")
    return jsonError("Sin permiso", 403);

  const { id } = await context.params;
  const ok = await dataService.deleteReferee(id);
  if (!ok) return jsonError("Juez no encontrado", 404);
  return jsonOk({ deleted: true });
}
