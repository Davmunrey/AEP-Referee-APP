import type { UserRole } from "@/lib/types";
import { request } from "./request";

export const adminApi = {
  toggleUserActive: (id: string, activo: boolean) =>
    request<{ id: string; activo: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }),

  updateUser: (
    id: string,
    body: {
      activo?: boolean;
      role?: UserRole;
      zona?: string | null;
      rolLabel?: string;
      nombre?: string;
    },
  ) =>
    request<{ id: string; activo: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<{ deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),

  /** Admin: resetea la contraseña de cualquier usuario (sin conocer la actual). */
  resetUserPassword: (id: string, password: string) =>
    request<{ updated: boolean }>(`/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  /** Self: cambia la propia contraseña verificando la actual. */
  changeOwnPassword: (currentPassword: string, newPassword: string) =>
    request<{ updated: boolean }>(`/auth/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
