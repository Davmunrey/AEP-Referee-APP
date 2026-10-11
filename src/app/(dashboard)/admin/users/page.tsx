import { UsersAdmin } from "@/components/admin/users-admin";
import { canManageUsers, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { listAdminUsers, type AdminUserRow } from "@/server/services/admin-users";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();
  if (!canManageUsers(user)) redirect("/");

  // Carga inicial desde el servidor: la página llega con los usuarios ya
  // renderizados. Si falla (p. ej. Supabase no configurado en dev), se deja
  // `initialUsers` sin definir y el componente cae al fetch cliente, que
  // mostrará el error/estado apropiado.
  // Las zonas y los usuarios no dependen entre sí: van a la vez. Un fallo de
  // las zonas sigue tumbando la página, como antes; uno de los usuarios no.
  const [meta, initialUsers] = await Promise.all([
    dataService.getMeta(user),
    listAdminUsers().catch((): AdminUserRow[] | undefined => undefined),
  ]);

  return (
    <UsersAdmin
      zones={meta.zones}
      initialUsers={initialUsers}
      canManageRestrictedRoles={user.role === "super_admin"}
    />
  );
}
