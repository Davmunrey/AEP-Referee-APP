import { UsersAdmin } from "@/components/admin/users-admin";
import { canManageUsers, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");
  if (!canManageUsers(user)) redirect("/");

  const meta = await dataService.getMeta(user);
  return <UsersAdmin zones={meta.zones} />;
}
