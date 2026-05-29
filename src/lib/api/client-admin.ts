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
      role?: "super_admin" | "delegado_jueces" | "delegado_zona" | "solo_ver";
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
};
