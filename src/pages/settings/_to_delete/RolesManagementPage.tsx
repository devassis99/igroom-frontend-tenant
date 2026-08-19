import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import {
  listRoles,
  listPermissionsCatalog,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
  type StaffRoleDef,
  type PermissionCatalogEntry,
} from "@/lib/roles-api";

const EMPTY_ROLES: StaffRoleDef[] = [];
const EMPTY_PERMISSIONS: PermissionCatalogEntry[] = [];

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  role: StaffRoleDef | null;
  permissionsCatalog: PermissionCatalogEntry[];
}

/** One modal for both "+ New Role" and editing an existing one — `role: null` means create mode, same "null doubles as the value" pattern StaffManagementPage's EditMemberModal uses. */
function RoleFormModal({ open, onClose, role, permissionsCatalog }: RoleFormModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelectedKeys(new Set(role?.permissions ?? []));
    setFormError(null);
  }, [open, role]);

  const isSystem = role?.isSystem ?? false;

  function togglePermission(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const permissionKeys = Array.from(selectedKeys);
      if (role) {
        if (!isSystem) {
          await updateRole(accessToken ?? "", role.id, { name, description });
          await updateRolePermissions(accessToken ?? "", role.id, permissionKeys);
        } else {
          await updateRole(accessToken ?? "", role.id, { description });
        }
      } else {
        await createRole(accessToken ?? "", { name, description, permissionKeys });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Couldn't save this role — try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSystem && !name.trim()) {
      setFormError("Give this role a name.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">
            {role ? `Edit ${role.name}` : "New Role"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          <Field label="NAME">
            <input
              type="text"
              placeholder="Front Desk Lead"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
              className={formInputClass}
            />
          </Field>
          {isSystem && (
            <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">
              The Owner role can&rsquo;t be renamed and always has every permission.
            </p>
          )}

          <Field label="DESCRIPTION">
            <input
              type="text"
              placeholder="What does this role do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={formInputClass}
            />
          </Field>

          <div>
            <p className="m-0 mb-2 font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-faint">
              PERMISSIONS
            </p>
            <div className="flex flex-col gap-2 rounded-xl border border-tn-border p-3.5">
              {permissionsCatalog.map((p) => (
                <label key={p.key} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSystem || selectedKeys.has(p.key)}
                    onChange={() => togglePermission(p.key)}
                    disabled={isSystem}
                    className="mt-0.5 accent-tn-gold"
                  />
                  <span>
                    <p className="m-0 font-sans text-[13px] font-medium text-tn-ink">{p.name}</p>
                    {p.description && (
                      <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                        {p.description}
                      </p>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {formError && <p className="m-0 font-sans text-sm text-tn-danger">{formError}</p>}

          <div className="flex gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : role ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The "Manage roles & permissions" screen linked from T12g2's Staff
 * Management page — lists every custom role on the account (Owner
 * first, protected), lets an owner/manager with the roles.manage
 * permission create new ones, edit an existing one's name/description/
 * permissions, or delete one nobody's currently assigned to. All three
 * mutations are gated server-side by staff-roles.service.ts regardless
 * of what this page shows/hides — see use-permissions.ts's comment.
 */
export function RolesManagementPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const { has: hasPermission } = usePermissions();
  const canManage = hasPermission("roles.manage");

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRoleDef | null>(null);
  const [deletingRole, setDeletingRole] = useState<StaffRoleDef | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const roles = rolesQuery.data?.roles ?? EMPTY_ROLES;

  const permissionsQuery = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: () => listPermissionsCatalog(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const permissionsCatalog = permissionsQuery.data?.permissions ?? EMPTY_PERMISSIONS;

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(accessToken ?? "", roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeletingRole(null);
    },
  });

  function openCreate() {
    setEditingRole(null);
    setFormOpen(true);
  }

  function openEdit(role: StaffRoleDef) {
    setEditingRole(role);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/settings/staff" className="font-sans text-[13px] text-tn-muted-5 no-underline">
            ← Staff Management
          </Link>
          <h1 className="m-0 mt-1 font-sans text-2xl font-semibold text-tn-ink">
            Roles &amp; Permissions
          </h1>
        </div>
        {canManage && <Button onClick={openCreate}>+ New Role</Button>}
      </div>

      {rolesQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load roles right now — refresh to try again.
        </p>
      )}
      {deleteMutation.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : "Couldn't delete this role — try again."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rolesQuery.isPending && (
          <p className="m-0 font-sans text-sm text-tn-muted-5">Loading roles…</p>
        )}

        {roles.map((role) => (
          <div
            key={role.id}
            className="flex flex-col gap-3 rounded-2xl border border-tn-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 flex items-center gap-2 font-sans text-[15px] font-semibold text-tn-ink">
                  {role.name}
                  {role.isSystem && (
                    <span className="rounded-full bg-tn-gold-bg px-2 py-0.5 font-sans text-[10px] font-semibold text-tn-gold">
                      OWNER ROLE
                    </span>
                  )}
                </p>
                {role.description && (
                  <p className="m-0 mt-1 font-sans text-[13px] text-tn-muted-5">
                    {role.description}
                  </p>
                )}
                <p className="m-0 mt-1 font-sans text-xs text-tn-muted-6">
                  {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-none gap-3 font-sans text-tn-muted-5">
                  <button
                    type="button"
                    title="Edit role"
                    aria-label={`Edit ${role.name}`}
                    onClick={() => openEdit(role)}
                    className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title={
                      role.isSystem
                        ? "The Owner role can't be deleted"
                        : role.memberCount > 0
                          ? "Reassign every member with this role before deleting it"
                          : "Delete role"
                    }
                    aria-label={`Delete ${role.name}`}
                    onClick={() => setDeletingRole(role)}
                    disabled={role.isSystem || role.memberCount > 0}
                    className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {role.permissions.length === 0 && (
                <span className="font-sans text-xs text-tn-muted-6">No permissions granted</span>
              )}
              {role.permissions.map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-tn-table-head px-2 py-0.5 font-sans text-[11px] text-tn-muted-3"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <RoleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        role={editingRole}
        permissionsCatalog={permissionsCatalog}
      />
      <ConfirmModal
        open={deletingRole !== null}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
        title={`Delete ${deletingRole?.name}?`}
        body="This can't be undone. Anyone currently assigned to it would need to be reassigned first."
        confirmLabel="Delete"
        confirming={deleteMutation.isPending}
        danger
      />
    </div>
  );
}

export default RolesManagementPage;
