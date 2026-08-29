import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { Field, formInputClass } from "@/components/ui/FormField";
import { Toast, type ToastTone } from "@/components/ui/Toast";
import { SeatUpgradeModal } from "@/components/settings/SeatUpgradeModal";
import { AddMemberWizard } from "@/components/settings/AddMemberWizard";
import { EditMemberModal } from "@/components/settings/EditMemberModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import {
  createStaffInviteLink,
  listStaff,
  resendStaffInvite,
  setStaffActive,
  type StaffMember,
} from "@/lib/staff-api";
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

type StaffTab = "members" | "roles";

const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

// Stable empty-array fallbacks — see CalendarPage.tsx's identical comment on why a fresh `[]` literal per render would defeat memoization downstream.
const EMPTY_STAFF: StaffMember[] = [];
const EMPTY_ROLES: StaffRoleDef[] = [];
const EMPTY_PERMISSIONS: PermissionCatalogEntry[] = [];

/** No stored color/photo for a real staff_users row (see Avatar.tsx's comment — flat color circles, no photos) — pick one deterministically from the id so the same member always lands on the same color across renders and reloads. */
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  role: StaffRoleDef | null;
  permissionsCatalog: PermissionCatalogEntry[];
}

/** One modal for both "+ New Role" and editing an existing one — `role: null` means create mode, same "null doubles as the value" pattern EditMemberModal uses for members. */
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

function tabButtonClass(active: boolean) {
  return `flex cursor-pointer items-center gap-1.5 border-none bg-transparent border-b-2 px-0.5 pb-3 font-sans text-[13px] font-semibold ${
    active
      ? "border-tn-gold text-tn-ink"
      : "border-transparent text-tn-muted-3 hover:text-tn-ink-soft"
  }`;
}

/**
 * Wraps whichever tab's content is currently showing so switching between
 * Members and Roles gets a small fade + rise instead of the new table just
 * popping in — mounts hidden, then flips visible a tick later (same
 * mount-then-flip trick as Toast.tsx's entrance animation). The caller
 * passes `key={activeTab}` so React remounts this fresh on every tab
 * change rather than reusing the instance, which is what makes the
 * animation replay each time instead of only on first load.
 */
function TabPanel({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`flex flex-col gap-6 transition-all duration-200 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Matches the mockup's T12g2 Staff Management table + the T12g2→h–l "New
 * Member" flow, plus what used to be a separate "Manage roles &
 * permissions" page (T12g2's own link into Roles & Permissions) now
 * folded into this same page as a second tab — Members and Roles share
 * one screen with one menu selector switching both the table below and
 * the "+ New Member"/"+ New Role" action, rather than Roles living behind
 * a standalone route. Both are backed by real igroom-backend data (see
 * staff-api.ts / roles-api.ts).
 */
export function StaffManagementPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const owner = useAuthStore((s) => s.owner);
  const queryClient = useQueryClient();
  const { has: hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState<StaffTab>("members");

  // --- Members ---
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [togglingMember, setTogglingMember] = useState<StaffMember | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => listStaff(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const staff = staffQuery.data?.staff ?? EMPTY_STAFF;

  // "Members" tab count is active staff only — Deactivated (and
  // not-yet-claimed Invited) members still show up in the table below,
  // they just don't count toward the headline number.
  const activeStaffCount = staff.filter((member) => member.isActive).length;

  const canManageStaff = hasPermission("staff.manage");

  /**
   * "Resend invite" on a row nobody has claimed yet.
   *
   * Worth having as its own action rather than telling an owner to
   * delete and re-invite: the member's role, locations and service
   * assignments are already set up on that row, and re-creating them is
   * both work and a chance to get it wrong. Resending supersedes the old
   * link server-side, so a forwarded email stops working.
   */
  const [resentFor, setResentFor] = useState<string | null>(null);
  const [inviteToast, setInviteToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const resendInviteMutation = useMutation({
    mutationFn: (staffId: string) => resendStaffInvite(accessToken ?? "", staffId),
    onSuccess: (result, staffId) => {
      // "Sent" only for a send that actually happened. The other two
      // outcomes both re-minted a valid link but delivered nothing, and
      // they need different fixes — so they get different words.
      setResentFor(result.invite.delivery === "sent" ? staffId : null);
      // Same in reverse — a resend supersedes a link somebody just copied.
      setCopiedFor(null);
      if (result.invite.delivery === "sent") {
        setInviteToast({ message: "Invite sent", tone: "success" });
      } else if (result.invite.delivery === "logged") {
        setInviteToast({
          message: "No email provider set up — the invite link is in the server console",
          tone: "notice",
        });
      } else {
        setInviteToast({
          message: "Couldn't send that email — the link is valid, see the server log",
          tone: "danger",
        });
      }
    },
    onError: () =>
      setInviteToast({ message: "Couldn't resend the invite — try again", tone: "danger" }),
  });

  /**
   * "Copy link" — the same setup link, to pass on by hand when email
   * isn't getting there. Common enough on a fresh install (no provider
   * configured) or an unverified sending domain that telling an owner to
   * go and read the server console is not a real answer.
   *
   * Two things it has to be honest about, both of which the toast says:
   * it supersedes the emailed link (the server can only mint, never look
   * up — the token is stored hashed), and the thing now on the clipboard
   * is a credential.
   */
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const copyLinkMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { invite } = await createStaffInviteLink(accessToken ?? "", staffId);
      // Written inside the mutation so a clipboard rejection — an
      // insecure origin, a browser that wants a fresher user gesture —
      // surfaces as a failure rather than a silent success over an empty
      // clipboard. The link is in the message either way.
      await navigator.clipboard.writeText(invite.url);
      return invite;
    },
    onSuccess: (_invite, staffId) => {
      setCopiedFor(staffId);
      // Copying minted a new token, so whatever "Sent" referred to is
      // dead. Leaving both badges up would claim two working links.
      setResentFor(null);
      setInviteToast({
        message: "Setup link copied — it replaces the emailed one, so send it to them directly",
        tone: "notice",
      });
    },
    onError: () =>
      setInviteToast({
        message: "Couldn't copy the link — check clipboard permissions and try again",
        tone: "danger",
      }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setStaffActive(accessToken ?? "", id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
      // CalendarPage's Day view keys its own roster fetch as
      // ["bookings-staff", locationId] even though it hits this same
      // GET /bookings/staff endpoint — a distinct cache entry from this
      // page's ["staff"], so without this it can keep showing a
      // just-deactivated (or reactivated) member for up to the 30s
      // staleTime, or indefinitely if the Calendar tab stayed mounted.
      queryClient.invalidateQueries({ queryKey: ["bookings-staff"] });
      setTogglingMember(null);
    },
  });

  function handleNewMember() {
    setSeatModalOpen(true);
  }

  function handleUpgrade() {
    setSeatModalOpen(false);
    setWizardOpen(true);
  }

  // --- Roles ---
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRoleDef | null>(null);
  const [deletingRole, setDeletingRole] = useState<StaffRoleDef | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const roles = rolesQuery.data?.roles ?? EMPTY_ROLES;
  const roleCount = roles.length;

  const permissionsQuery = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: () => listPermissionsCatalog(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const permissionsCatalog = permissionsQuery.data?.permissions ?? EMPTY_PERMISSIONS;

  const canViewRoles = hasPermission("roles.view");
  const canManageRoles = hasPermission("roles.manage");

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(accessToken ?? "", roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeletingRole(null);
    },
  });

  function openCreateRole() {
    setEditingRole(null);
    setRoleFormOpen(true);
  }

  function openEditRole(role: StaffRoleDef) {
    setEditingRole(role);
    setRoleFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Staff Management</h1>
        {activeTab === "members"
          ? canManageStaff && <Button onClick={handleNewMember}>+ New Member</Button>
          : canManageRoles && <Button onClick={openCreateRole}>+ New Role</Button>}
      </div>

      <div className="flex items-center gap-6 border-b border-tn-border-soft">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={tabButtonClass(activeTab === "members")}
        >
          Members <span>{activeStaffCount}</span>
        </button>
        {canViewRoles && (
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={tabButtonClass(activeTab === "roles")}
          >
            Roles <span>({roleCount})</span>
          </button>
        )}
      </div>

      <TabPanel key={activeTab}>
        {activeTab === "members" ? (
          <>
            {staffQuery.isError && (
              <p className="m-0 font-sans text-sm text-tn-danger">
                Couldn&rsquo;t load your team right now (
                {staffQuery.error instanceof Error ? staffQuery.error.message : "unknown error"}) —
                refresh to try again.
              </p>
            )}

            <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              <div className="grid grid-cols-[1.8fr_1fr_1.2fr_0.8fr_0.8fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
                <span>Name</span>
                <span>Role</span>
                <span>Locations</span>
                <span>Status</span>
                <span>Shortcuts</span>
              </div>

              {staffQuery.isPending && (
                <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">Loading your team…</p>
              )}
              {!staffQuery.isPending && staff.length === 0 && (
                <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">
                  No team members yet — add your first one.
                </p>
              )}

              {staff.map((member, i) => {
                const isSelf = owner !== null && member.email === owner.workEmail;
                const statusTone = !member.isActive
                  ? "neutral"
                  : member.claimed
                    ? "success"
                    : "gold";
                const statusLabel = !member.isActive
                  ? "Deactivated"
                  : member.claimed
                    ? "Active"
                    : "Invited";

                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-[1.8fr_1fr_1.2fr_0.8fr_0.8fr] items-center px-[18px] py-3.5 ${
                      i < staff.length - 1 ? "border-b border-tn-border-soft" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Avatar
                        initials={initialsFor(member.name)}
                        color={avatarColorFor(member.id)}
                        size={28}
                      />
                      <span>
                        <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                          {member.name}
                        </p>
                        <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                          {member.email}
                        </p>
                      </span>
                    </span>
                    <span className="font-sans text-[13px] text-tn-muted-2">{member.roleName}</span>
                    {/* Every shop, comma-joined — one line per person, not
                        one per membership, so a member working two sites
                        doesn't read as two people. */}
                    <span
                      className="truncate font-sans text-[13px] text-tn-muted-2"
                      title={member.locations.map((loc) => loc.name).join(", ")}
                    >
                      {member.locations.length > 0
                        ? member.locations.map((loc) => loc.name).join(", ")
                        : "—"}
                    </span>
                    <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                    <span className="flex gap-2 font-sans text-tn-muted-5">
                      <button
                        type="button"
                        title={
                          canManageStaff
                            ? "Edit profile"
                            : "You don't have permission to edit staff"
                        }
                        aria-label={`Edit ${member.name}`}
                        onClick={() => setEditingMember(member)}
                        disabled={!canManageStaff}
                        className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✎
                      </button>
                      {!member.claimed && member.isActive && (
                        <button
                          type="button"
                          title={
                            canManageStaff
                              ? "Email them a fresh setup link"
                              : "You don't have permission to do this"
                          }
                          aria-label={`Resend the invite to ${member.name}`}
                          onClick={() => resendInviteMutation.mutate(member.id)}
                          disabled={!canManageStaff || resendInviteMutation.isPending}
                          className="cursor-pointer border-none bg-transparent p-0 font-sans text-[11px] font-semibold text-tn-gold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {resentFor === member.id ? "Sent" : "Resend"}
                        </button>
                      )}
                      {!member.claimed && member.isActive && (
                        <button
                          type="button"
                          title={
                            canManageStaff
                              ? "Copy a setup link to send them yourself — replaces the emailed one"
                              : "You don't have permission to do this"
                          }
                          aria-label={`Copy a setup link for ${member.name}`}
                          onClick={() => copyLinkMutation.mutate(member.id)}
                          disabled={!canManageStaff || copyLinkMutation.isPending}
                          className="cursor-pointer border-none bg-transparent p-0 font-sans text-[11px] font-semibold text-tn-muted-5 hover:text-tn-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {copiedFor === member.id ? "Copied" : "Copy link"}
                        </button>
                      )}
                      <button
                        type="button"
                        title={
                          isSelf
                            ? "You can't deactivate your own account"
                            : canManageStaff
                              ? "Activate/deactivate"
                              : "You don't have permission to do this"
                        }
                        aria-label={
                          member.isActive ? `Deactivate ${member.name}` : `Activate ${member.name}`
                        }
                        onClick={() => setTogglingMember(member)}
                        disabled={isSelf || !canManageStaff}
                        className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {/*
                          Deliberately NOT the ⌫ the Roles table below
                          uses: that one really does delete, this only
                          flips staff_users.isActive. Staff are never
                          hard-deleted (see staff-users.ts, and
                          bookings.staffUserId's RESTRICT) so a trash icon
                          here would promise something no endpoint can do.
                          ⊘ removes them from the roster, ↺ puts them
                          back — the icon changes with the direction the
                          click will go, so it never reads as a one-way
                          destructive action.

                          Both are plain text glyphs (U+2298 / U+21BA)
                          with no emoji presentation, so they inherit
                          text-tn-muted-5 like ✎ does instead of rendering
                          as a full-colour emoji next to it.
                        */}
                        {member.isActive ? "⊘" : "↺"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="m-0 font-sans text-xs text-tn-muted-6">
              ✎ opens the profile edit. ⊘ removes a member from the active roster; ↺ brings a
              deactivated one back. Staff are deactivated rather than deleted so their past bookings
              keep the right name on them.
            </p>
          </>
        ) : (
          <>
            {rolesQuery.isError && (
              <p className="m-0 font-sans text-sm text-tn-danger">
                Couldn&rsquo;t load roles right now — refresh to try again.
              </p>
            )}
            {deleteRoleMutation.isError && (
              <p className="m-0 font-sans text-sm text-tn-danger">
                {deleteRoleMutation.error instanceof Error
                  ? deleteRoleMutation.error.message
                  : "Couldn't delete this role — try again."}
              </p>
            )}

            <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
              <div className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1.2fr_0.8fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
                <span>Role</span>
                <span>Description</span>
                <span>Members</span>
                <span>Permissions</span>
                <span>Shortcuts</span>
              </div>

              {rolesQuery.isPending && (
                <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">Loading roles…</p>
              )}
              {!rolesQuery.isPending && roles.length === 0 && (
                <p className="m-0 p-[18px] font-sans text-sm text-tn-muted-5">
                  No roles yet — add your first one.
                </p>
              )}

              {roles.map((role, i) => (
                <div
                  key={role.id}
                  className={`grid grid-cols-[1.4fr_1.8fr_0.8fr_1.2fr_0.8fr] items-center px-[18px] py-3.5 ${
                    i < roles.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 font-sans text-[13px] font-semibold text-tn-ink">
                    {role.name}
                    {role.isSystem && (
                      <span className="rounded-full bg-tn-gold-bg px-2 py-0.5 font-sans text-[10px] font-semibold text-tn-gold">
                        OWNER
                      </span>
                    )}
                  </span>
                  <span className="truncate font-sans text-[13px] text-tn-muted-2">
                    {role.description || "—"}
                  </span>
                  <span className="font-sans text-[13px] text-tn-muted-2">{role.memberCount}</span>
                  <span className="font-sans text-[13px] text-tn-muted-2">
                    {role.isSystem
                      ? "All permissions"
                      : `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"}`}
                  </span>
                  <span className="flex gap-2 font-sans text-tn-muted-5">
                    {/* The Owner role can't be edited or deleted (isSystem —
                      see staff-roles.service.ts's updateRole/deleteRole
                      guards, which reject this server-side too), so this
                      row gets no shortcuts at all rather than a pair of
                      permanently-disabled icons. */}
                    {canManageRoles && !role.isSystem && (
                      <>
                        <button
                          type="button"
                          title="Edit role"
                          aria-label={`Edit ${role.name}`}
                          onClick={() => openEditRole(role)}
                          className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title={
                            role.memberCount > 0
                              ? "Reassign every member with this role before deleting it"
                              : "Delete role"
                          }
                          aria-label={`Delete ${role.name}`}
                          onClick={() => setDeletingRole(role)}
                          disabled={role.memberCount > 0}
                          className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {/*
                            ⌫ (U+232B) rather than 🗑: this file's other
                            glyphs (✎, ×, ✓) are all plain text that
                            inherit text-tn-muted-5, and the trash can has
                            no monochrome codepoint — it always renders as
                            a full-colour emoji. × isn't free either; it's
                            this app's modal-close glyph, so reusing it
                            for a destructive action would blur the two.
                          */}
                          ⌫
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {canManageRoles && (
              <p className="m-0 font-sans text-xs text-tn-muted-6">
                ✎ edits this role. ⌫ deletes it (once nobody&rsquo;s assigned to it).
              </p>
            )}
          </>
        )}
      </TabPanel>

      <SeatUpgradeModal
        open={seatModalOpen}
        onClose={() => setSeatModalOpen(false)}
        onUpgrade={handleUpgrade}
      />
      {/* Anything that isn't a plain success stays until dismissed — these
          two say where to look for the link, which is no use if it
          disappears while you're reading it. */}
      {inviteToast && (
        <Toast
          message={inviteToast.message}
          tone={inviteToast.tone}
          duration={inviteToast.tone === "success" ? 3000 : 0}
          onDismiss={() => setInviteToast(null)}
        />
      )}
      <AddMemberWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />
      <ConfirmModal
        open={togglingMember !== null}
        onClose={() => setTogglingMember(null)}
        onConfirm={() =>
          togglingMember &&
          toggleActiveMutation.mutate({ id: togglingMember.id, isActive: !togglingMember.isActive })
        }
        title={
          togglingMember?.isActive
            ? `Deactivate ${togglingMember.name}?`
            : `Activate ${togglingMember?.name}?`
        }
        body={
          togglingMember?.isActive
            ? "They'll be signed out and won't be able to log back in until reactivated."
            : "They'll be able to sign in again."
        }
        confirmLabel={togglingMember?.isActive ? "Deactivate" : "Activate"}
        confirming={toggleActiveMutation.isPending}
        danger={togglingMember?.isActive ?? false}
      />

      <RoleFormModal
        open={roleFormOpen}
        onClose={() => setRoleFormOpen(false)}
        role={editingRole}
        permissionsCatalog={permissionsCatalog}
      />
      <ConfirmModal
        open={deletingRole !== null}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => deletingRole && deleteRoleMutation.mutate(deletingRole.id)}
        title={`Delete ${deletingRole?.name}?`}
        body="This can't be undone. Anyone currently assigned to it would need to be reassigned first."
        confirmLabel="Delete"
        confirming={deleteRoleMutation.isPending}
        danger
      />
    </div>
  );
}

export default StaffManagementPage;
