import { UsersAdmin } from "@/components/admin/users-admin";
import { canManageUsers, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { listAdminUsers, type AdminUserRow } from "@/server/services/admin-users";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");
  if (!canManageUsers(user)) redirect("/");

  const meta = await dataService.getMeta(user);

  // Carga inicial desde el servidor: la página llega con los usuarios ya
  // renderizados. Si falla (p. ej. Supabase no configurado en dev), se deja
  // `initialUsers` sin definir y el componente cae al fetch cliente, que
  // mostrará el error/estado apropiado.
  let initialUsers: AdminUserRow[] | undefined;
  try {
    initialUsers = await listAdminUsers();
  } catch {
    initialUsers = undefined;
  }

  return <UsersAdmin zones={meta.zones} initialUsers={initialUsers} />;
}
