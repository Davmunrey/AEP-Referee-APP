"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { selectFieldClass } from "@/lib/design-tokens";
import { getApiBaseUrl } from "@/lib/api/config";
import { api } from "@/lib/api/client";
import type { UserRole } from "@/lib/types";
import { Loader2, Trash2 } from "lucide-react";

interface ProfileRow {
  id: string;
  email: string;
  nombre: string;
  rol_label: string;
  role: UserRole;
  zona: string | null;
  activo: boolean;
}

interface UsersAdminProps {
  zones: { code: string; name: string }[];
}

export function UsersAdmin({ zones }: UsersAdminProps) {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    rolLabel: "",
    role: "delegado_zona" as UserRole,
    zona: zones[0]?.code ?? "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/users`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar usuarios");
      setUsers(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (id: string, current: boolean) => {
    setActionId(id);
    setError(null);
    try {
      await api.toggleUserActive(id, !current);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, activo: !current } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setActionId(null);
    }
  };

  const deleteUser = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setActionId(id);
    setError(null);
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActionId(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          rolLabel: form.rolLabel,
          role: form.role,
          zona: form.role === "delegado_zona" ? form.zona : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el usuario");
      setForm({
        email: "",
        password: "",
        nombre: "",
        rolLabel: "",
        role: "delegado_zona",
        zona: zones[0]?.code ?? "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios federativos"
        description="Alta de representantes regionales y cuentas de consulta. Solo accesible para AEP Nacional."
      />

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="glass-panel mb-8 grid gap-4 rounded-2xl border border-border-muted p-6 md:grid-cols-2"
      >
        <h2 className="friendly-label md:col-span-2">Nuevo usuario</h2>
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <Input
          placeholder="Contraseña (mín. 8)"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          minLength={8}
        />
        <Input
          placeholder="Nombre completo"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          required
        />
        <Input
          placeholder="Etiqueta de rol (ej. Resp. Cataluña)"
          value={form.rolLabel}
          onChange={(e) => setForm((f) => ({ ...f, rolLabel: e.target.value }))}
          required
        />
        <select
          className={selectFieldClass}
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
        >
          <option value="super_admin">Super Admin</option>
          <option value="delegado_jueces">Delegado de Jueces</option>
          <option value="delegado_zona">Delegado de Zona</option>
          <option value="solo_ver">Solo Ver</option>
        </select>
        {form.role === "delegado_zona" && (
          <select
            className={selectFieldClass}
            value={form.zona}
            onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
          >
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
        )}
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear usuario"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-subtle-muted">Cargando usuarios…</p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableHeadCell>Nombre</DataTableHeadCell>
              <DataTableHeadCell>Email</DataTableHeadCell>
              <DataTableHeadCell>Rol</DataTableHeadCell>
              <DataTableHeadCell>Zona</DataTableHeadCell>
              <DataTableHeadCell>Estado</DataTableHeadCell>
              <DataTableHeadCell>Acciones</DataTableHeadCell>
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {users.map((u) => (
              <DataTableRow key={u.id}>
                <DataTableCell>{u.nombre}</DataTableCell>
                <DataTableCell className="font-mono text-xs">{u.email}</DataTableCell>
                <DataTableCell>{u.rol_label}</DataTableCell>
                <DataTableCell>{u.zona ?? "—"}</DataTableCell>
                <DataTableCell>
                  <span className={u.activo ? "text-success" : "text-muted-foreground"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId === u.id}
                      onClick={() => void toggleActive(u.id, u.activo)}
                    >
                      {actionId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : u.activo ? (
                        "Desactivar"
                      ) : (
                        "Activar"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={actionId === u.id}
                      onClick={() => void deleteUser(u.id, u.nombre)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </PageShell>
  );
}
