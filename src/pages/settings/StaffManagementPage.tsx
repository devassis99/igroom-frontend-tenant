import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SeatUpgradeModal } from "@/components/settings/SeatUpgradeModal";
import { AddMemberWizard } from "@/components/settings/AddMemberWizard";
import { EditMemberModal } from "@/components/settings/EditMemberModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { listStaff, setStaffActive, type StaffMember } from "@/lib/staff-api";
import { listRoles } from "@/lib/roles-api";

const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

// Stable empty-array fallback — see CalendarPage.tsx's identical comment on why a fresh `[]` literal per render would defeat memoization downstream.
const EMPTY_STAFF: StaffMember[] = [];

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

/** Matches the mockup's T12g2 Staff Management table + the T12g2→h–l "New Member" flow, now backed by real igroom-backend data (see staff-api.ts) instead of a static list. Role counts and the "Manage roles & permissions" link (T12g2's own link into the Roles & Permissions screen) come from roles-api.ts's custom, per-account roles. */
export function StaffManagementPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const owner = useAuthStore((s) => s.owner);
  const queryClient = useQueryClient();
  const { has: hasPermission } = usePermissions();

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

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const roleCount = rolesQuery.data?.roles.length ?? 0;

  const canManageStaff = hasPermission("staff.manage");
  const canViewRoles = hasPermission("roles.view");

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setStaffActive(accessToken ?? "", id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-performance"] });
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Staff Management</h1>
        {canManageStaff && <Button onClick={handleNewMember}>+ New Member</Button>}
      </div>

      <div className="flex items-center gap-5 font-sans text-[13px] font-medium text-tn-muted-3">
        <span>
          Members <span className="font-semibold text-tn-ink">{staff.length}</span>
        </span>
        <span>
          Roles <span className="font-semibold text-tn-ink">{roleCount}</span>
        </span>
        {canViewRoles && (
          <Link to="/settings/staff/roles" className="font-semibold text-tn-blue no-underline">
            Manage roles &amp; permissions →
          </Link>
        )}
      </div>

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
          <span>Location</span>
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
          const statusTone = !member.isActive ? "neutral" : member.claimed ? "success" : "gold";
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
                  <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{member.email}</p>
                </span>
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">{member.roleName}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">{member.locationName}</span>
              <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
              <span className="flex gap-2 font-sans text-tn-muted-5">
                <button
                  type="button"
                  title={
                    canManageStaff ? "Edit profile" : "You don't have permission to edit staff"
                  }
                  aria-label={`Edit ${member.name}`}
                  onClick={() => setEditingMember(member)}
                  disabled={!canManageStaff}
                  className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ✎
                </button>
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
                  ⋮
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <p className="m-0 font-sans text-xs text-tn-muted-6">
        ✎ opens the profile edit. ⋮ activates or deactivates this member.
      </p>

      <SeatUpgradeModal
        open={seatModalOpen}
        onClose={() => setSeatModalOpen(false)}
        onUpgrade={handleUpgrade}
      />
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
    </div>
  );
}

export default StaffManagementPage;
