import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { resolveSessionUser } from "@/lib/auth/session";

// El alta automática de perfil decide si el usuario entrante es super_admin:
// es la frontera de privilegios de la aplicación, así que el camino de error
// tiene que fallar cerrado.

type Row = Record<string, unknown> | null;

/** Cliente admin falso: `profiles` responde lo que diga cada test. */
function fakeAdmin(opts: {
  existingProfile?: Row;
  count?: number | null;
  countError?: { message: string } | null;
  insertedProfile?: Row;
}) {
  const upserts: Record<string, unknown>[] = [];
  let selectedAfterUpsert = false;
  const client = {
    from: () => {
      const state = { head: false };
      const q = {
        select: (_cols: string, options?: { head?: boolean }) => {
          state.head = Boolean(options?.head);
          return q;
        },
        upsert: (row: Record<string, unknown>) => {
          upserts.push(row);
          return Promise.resolve({ data: null, error: null });
        },
        eq: () => q,
        maybeSingle: async () => ({ data: opts.existingProfile ?? null, error: null }),
        single: async () => {
          selectedAfterUpsert = true;
          return { data: opts.insertedProfile ?? null, error: null };
        },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(
            state.head
              ? { count: opts.count ?? null, error: opts.countError ?? null }
              : { data: null, error: null },
          ).then(resolve),
      };
      return q;
    },
  };
  return { client, upserts, selectedAfterUpsert: () => selectedAfterUpsert };
}

const authUser = { id: "u-1", email: "nuevo@aep.es", user_metadata: {} } as unknown as User;

describe("resolveSessionUser — alta automática de perfil", () => {
  it("no da de alta a nadie si falla el recuento de perfiles", async () => {
    // `count` volvía como null ante un error y se leía como «no hay perfiles
    // todavía»: quien se registrase durante un fallo transitorio de la base de
    // datos entraba como super_admin activo.
    const admin = fakeAdmin({ count: null, countError: { message: "network" } });
    const user = await resolveSessionUser(admin.client as never, authUser);
    expect(user).toBeNull();
    expect(admin.upserts).toEqual([]);
  });

  it("el primer perfil de la instalación sí es super_admin", async () => {
    const admin = fakeAdmin({
      count: 0,
      insertedProfile: {
        id: "u-1",
        email: "nuevo@aep.es",
        nombre: "Nuevo",
        rol_label: "Super Admin",
        iniciales: "NU",
        role: "super_admin",
        zona: null,
        activo: true,
      },
    });
    const user = await resolveSessionUser(admin.client as never, authUser);
    expect(user?.role).toBe("super_admin");
    expect(admin.upserts[0]).toMatchObject({ role: "super_admin", activo: true });
  });

  it("con perfiles ya existentes el alta es solo_ver e inactiva", async () => {
    const admin = fakeAdmin({ count: 7, insertedProfile: null });
    await resolveSessionUser(admin.client as never, authUser);
    expect(admin.upserts[0]).toMatchObject({ role: "solo_ver", activo: false });
  });

  it("un perfil desactivado no abre sesión", async () => {
    const admin = fakeAdmin({
      existingProfile: {
        id: "u-1",
        email: "x@aep.es",
        nombre: "X",
        rol_label: "Pendiente",
        iniciales: "X",
        role: "solo_ver",
        zona: null,
        activo: false,
      },
    });
    expect(await resolveSessionUser(admin.client as never, authUser)).toBeNull();
  });
});
