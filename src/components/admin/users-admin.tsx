"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { selectFieldClass, selectFieldClassSm } from "@/lib/design-tokens";
import { getApiBaseUrl } from "@/lib/api/config";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import { KeyRound, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { EditUserDialog } from "./edit-user-dialog";
import { PasswordDialog } from "./password-dialog";
import type { EditFormState } from "./edit-user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import { CredentialsBanner } from "./credentials-banner";

interface ProfileRow {
  id: string;
  email: string;
  nombre: string;
  rol_label: string;
  role: UserRole;
  zona: string | null;
  activo: boolean;
  created_at?: string;
  /** Último inicio de sesión (auth.users.last_sign_in_at); null si nunca entró. */
  last_sign_in_at?: string | null;
}

interface UsersAdminProps {
  zones: { code: string; name: string }[];
}

const ROLE_BADGE_VARIANT: Record<UserRole, "nacional" | "regional" | "ipf2" | "muted"> = {
  super_admin: "nacional",
  delegado_jueces: "regional",
  delegado_zona: "ipf2",
  responsable_financiero_jueces: "muted",
  solo_ver: "muted",
};

function getInitials(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months !== 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years !== 1 ? "s" : ""}`;
}

/** Fecha y hora absoluta para el tooltip (title) de las celdas de tiempo. */
function formatAbsolute(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersAdmin({ zones }: UsersAdminProps) {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nombre: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<UserRole | "TODOS">("TODOS");
  const [filterZone, setFilterZone] = useState<string>("TODOS");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activo" | "inactivo">("todos");
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [pwdUser, setPwdUser] = useState<{ id: string; subject: string } | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    nombre: "",
    rolLabel: "",
    role: "delegado_zona",
    zona: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [credentialsBanner, setCredentialsBanner] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    rolLabel: "",
    role: "delegado_zona" as UserRole,
    zona: zones[0]?.code ?? "",
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/users`, { credentials: "include", signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar usuarios");
      setUsers(json.data ?? []);
    } catch (e) {
      // Petición cancelada (desmontaje): no tocar estado.
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (filterRole !== "TODOS" && u.role !== filterRole) return false;
    if (filterZone !== "TODOS" && u.zona !== filterZone) return false;
    if (filterEstado === "activo" && !u.activo) return false;
    if (filterEstado === "inactivo" && u.activo) return false;
    if (q && !u.nombre.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    return true;
  });

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

  const doDelete = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirm(null);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActionId(null);
    }
  };

  const handleEditClick = (user: ProfileRow) => {
    setEditUser(user);
    setEditForm({ nombre: user.nombre, rolLabel: user.rol_label, role: user.role, zona: user.zona ?? zones[0]?.code ?? "" });
    setEditError(null);
  };

  const doEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    if (editForm.role === "delegado_zona" && !editForm.zona) {
      setEditError("La zona es obligatoria para Delegado de Zona.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.updateUser(editUser.id, {
        nombre: editForm.nombre,
        rolLabel: editForm.rolLabel,
        role: editForm.role,
        zona: editForm.role === "delegado_zona" ? editForm.zona : null,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? { ...u, nombre: editForm.nombre, rol_label: editForm.rolLabel, role: editForm.role, zona: editForm.role === "delegado_zona" ? editForm.zona : null }
            : u,
        ),
      );
      setEditUser(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setEditSaving(false);
    }
  };

  const bulkSetActive = async (targetActivo: boolean) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      setActionId(id);
      try {
        await api.toggleUserActive(id, targetActivo);
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, activo: targetActivo } : u)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar");
        break;
      }
    }
    setActionId(null);
    setSelectedIds(new Set());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Misma validación que la edición: un Delegado de Zona necesita zona.
    if (form.role === "delegado_zona" && !form.zona) {
      setError("La zona es obligatoria para Delegado de Zona.");
      return;
    }
    setSaving(true);
    setError(null);
    const capturedEmail = form.email;
    const capturedPassword = form.password;
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, nombre: form.nombre, rolLabel: form.rolLabel, role: form.role, zona: form.role === "delegado_zona" ? form.zona : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo crear el usuario");
      setForm({ email: "", password: "", nombre: "", rolLabel: "", role: "delegado_zona", zona: zones[0]?.code ?? "" });
      await load();
      setCredentialsBanner({ email: capturedEmail, password: capturedPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentialsBanner) return;
    try {
      await navigator.clipboard.writeText(`Email: ${credentialsBanner.email}\nContraseña: ${credentialsBanner.password}`);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));
  const someFilteredSelected = filteredUsers.some((u) => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); filteredUsers.forEach((u) => next.delete(u.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); filteredUsers.forEach((u) => next.add(u.id)); return next; });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const hasFilters = filterRole !== "TODOS" || filterZone !== "TODOS" || filterEstado !== "todos" || search !== "";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios federativos"
        description="Alta de representantes regionales y cuentas de consulta. Solo accesible para AEP Nacional."
      />

      {/* Create user form */}
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="glass-panel mb-8 grid gap-4 rounded-2xl border border-border-muted p-6 md:grid-cols-2"
      >
        <h2 className="friendly-label md:col-span-2">Nuevo usuario</h2>
        <Input placeholder="Email" aria-label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <Input placeholder="Contraseña (mín. 8)" aria-label="Contraseña" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
        <Input placeholder="Nombre completo" aria-label="Nombre completo" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required />
        <Input placeholder="Etiqueta de rol (ej. Resp. Cataluña)" aria-label="Etiqueta de rol" value={form.rolLabel} onChange={(e) => setForm((f) => ({ ...f, rolLabel: e.target.value }))} required />
        <select className={selectFieldClass} value={form.role} aria-label="Rol del usuario" onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
          <option value="super_admin">Super Admin</option>
          <option value="delegado_jueces">Delegado de Jueces</option>
          <option value="delegado_zona">Delegado de Zona</option>
          <option value="responsable_financiero_jueces">Responsable Financiero Jueces</option>
          <option value="solo_ver">Solo Ver</option>
        </select>
        {form.role === "delegado_zona" && (
          <select className={selectFieldClass} value={form.zona} aria-label="Zona del delegado" onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}>
            {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
          </select>
        )}
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear usuario"}
          </Button>
          {error && !deleteConfirm && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </form>

      {/* Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Buscar por nombre o email…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-44 text-xs" aria-label="Buscar usuarios" />
        <select className={selectFieldClassSm} value={filterRole} onChange={(e) => setFilterRole(e.target.value as UserRole | "TODOS")} aria-label="Filtrar por rol">
          <option value="TODOS">Todos los roles</option>
          <option value="super_admin">{ROLE_LABELS.super_admin}</option>
          <option value="delegado_jueces">{ROLE_LABELS.delegado_jueces}</option>
          <option value="delegado_zona">{ROLE_LABELS.delegado_zona}</option>
          <option value="responsable_financiero_jueces">
            {ROLE_LABELS.responsable_financiero_jueces}
          </option>
          <option value="solo_ver">{ROLE_LABELS.solo_ver}</option>
        </select>
        <select className={selectFieldClassSm} value={filterZone} onChange={(e) => setFilterZone(e.target.value)} aria-label="Filtrar por zona">
          <option value="TODOS">Todas las zonas</option>
          {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
        </select>
        <select className={selectFieldClassSm} value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as "todos" | "activo" | "inactivo")} aria-label="Filtrar por estado">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={() => { setFilterRole("TODOS"); setFilterZone("TODOS"); setFilterEstado("todos"); setSearch(""); }} className="rounded px-2 py-1 text-xs text-subtle-muted transition-colors hover:text-foreground focus-ring">
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-subtle-muted">
          {filteredUsers.length} de {users.length} usuario{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-2.5">
          <span className="text-sm text-foreground-secondary">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void bulkSetActive(true)} disabled={actionId !== null}>Activar</Button>
            <Button size="sm" variant="outline" onClick={() => void bulkSetActive(false)} disabled={actionId !== null}>Desactivar</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Table or states */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-subtle-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando usuarios…
        </div>
      ) : error && users.length === 0 ? (
        <div role="alert" className="rounded-lg border border-destructive-border bg-destructive-muted px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin usuarios"
          description={users.length === 0 ? "Todavía no hay usuarios federativos registrados." : "Ningún usuario coincide con los filtros aplicados."}
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableHeadCell className="w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                  onChange={toggleSelectAll}
                  aria-label="Seleccionar todos"
                  className="h-4 w-4 rounded border-border-strong accent-primary"
                />
              </DataTableHeadCell>
              <DataTableHeadCell>Nombre</DataTableHeadCell>
              <DataTableHeadCell>Email</DataTableHeadCell>
              <DataTableHeadCell>Rol</DataTableHeadCell>
              <DataTableHeadCell>Zona</DataTableHeadCell>
              <DataTableHeadCell>Estado</DataTableHeadCell>
              <DataTableHeadCell>Alta</DataTableHeadCell>
              <DataTableHeadCell>Último acceso</DataTableHeadCell>
              <DataTableHeadCell>Acciones</DataTableHeadCell>
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {filteredUsers.map((u) => {
              const initials = getInitials(u.nombre);
              const isSelected = selectedIds.has(u.id);
              return (
                <DataTableRow key={u.id} className={cn(isSelected && "bg-primary/5")}>
                  <DataTableCell>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(u.id)} aria-label={`Seleccionar ${u.nombre}`} className="h-4 w-4 rounded border-border-strong accent-primary" />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">{initials}</span>
                      <span className="font-medium text-foreground">{u.nombre}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs">{u.email}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[u.role]}>{ROLE_LABELS[u.role] ?? u.rol_label}</Badge>
                  </DataTableCell>
                  <DataTableCell>{u.zona ?? "—"}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={u.activo ? "success" : "muted"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </DataTableCell>
                  <DataTableCell className="text-xs text-subtle-muted">
                    {u.created_at ? (
                      <span title={formatAbsolute(u.created_at)}>{formatRelativeTime(u.created_at)}</span>
                    ) : (
                      "—"
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-xs">
                    {u.last_sign_in_at ? (
                      <span className="text-foreground-secondary" title={formatAbsolute(u.last_sign_in_at)}>
                        {formatRelativeTime(u.last_sign_in_at)}
                      </span>
                    ) : (
                      <span className="text-subtle-muted" title="Nunca ha iniciado sesión">
                        Nunca
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={actionId === u.id} onClick={() => void toggleActive(u.id, u.activo)}>
                        {actionId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : u.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button variant="outline" size="sm" disabled={actionId === u.id} aria-label={`Editar ${u.nombre}`} onClick={() => handleEditClick(u)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={actionId === u.id} aria-label={`Resetear contraseña de ${u.nombre}`} title="Resetear contraseña" onClick={() => setPwdUser({ id: u.id, subject: `${u.nombre} · ${u.email}` })}>
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={actionId === u.id} aria-label={`Eliminar ${u.nombre}`} onClick={() => setDeleteConfirm({ id: u.id, nombre: u.nombre })}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}

      {editUser && (
        <EditUserDialog
          email={editUser.email}
          form={editForm}
          error={editError}
          saving={editSaving}
          zones={zones}
          onFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
          onSubmit={(e) => void doEdit(e)}
          onClose={() => setEditUser(null)}
        />
      )}

      {pwdUser && (
        <PasswordDialog
          mode="admin"
          userId={pwdUser.id}
          subject={pwdUser.subject}
          onClose={() => setPwdUser(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteUserDialog
          nombre={deleteConfirm.nombre}
          error={error}
          busy={actionId !== null}
          onConfirm={() => void doDelete(deleteConfirm.id)}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {credentialsBanner && (
        <CredentialsBanner
          email={credentialsBanner.email}
          password={credentialsBanner.password}
          copied={copiedCredentials}
          onCopy={() => void copyCredentials()}
          onClose={() => setCredentialsBanner(null)}
        />
      )}
    </PageShell>
  );
}
