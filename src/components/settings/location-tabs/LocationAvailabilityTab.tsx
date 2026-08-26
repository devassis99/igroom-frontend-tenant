import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { StaffAvailabilityEditor } from "@/components/availability/StaffAvailabilityEditor";
import { Avatar } from "@/components/ui/Avatar";
import { StaffFilterPopover } from "@/components/ui/StaffFilterPopover";
import {
  listLocationStaff,
  type AccountLocation,
  type LocationStaffMember,
} from "@/lib/locations-api";

// Same deterministic id->color hash as StaffPage.tsx/StaffManagementPage.tsx
// /StaffFilterPopover.tsx, so a given member keeps landing on the same
// avatar color here as in the popover you picked them from.
const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

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

/**
 * Names whose schedule is on screen.
 *
 * This exists because the first cut leaned on the editor's heading ("Set
 * <name>'s availability") to say who you were looking at, and hid the
 * member picker entirely when a location had only one person on the
 * roster — which is exactly the case where nothing else on the tab
 * names them. A long name also wrapped the heading into two lines and
 * read as a truncated sentence rather than an identity. Now the person
 * is stated once, plainly, in the same place whether there are one or
 * twenty of them.
 */
function MemberIdentity({ member, isSelf }: { member: LocationStaffMember; isSelf: boolean }) {
  const subtitle = [member.displayTitle ?? member.roleName, member.email]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar initials={initialsFor(member.name)} color={avatarColorFor(member.id)} size={36} />
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 font-sans text-sm font-semibold text-tn-ink">
          <span className="truncate">{member.name}</span>
          {isSelf && (
            <span className="flex-none rounded-full bg-tn-neutral-bg px-1.5 py-0.5 font-sans text-[10px] font-semibold text-tn-muted-5">
              You
            </span>
          )}
          {!member.hasHours && (
            <span className="flex-none rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[10px] font-semibold text-tn-gold">
              No hours set
            </span>
          )}
        </span>
        {subtitle && (
          <span className="truncate font-sans text-[11px] text-tn-muted-5">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

/**
 * A location's Availability tab — who can actually be booked here, and when.
 *
 * This replaces the old Opening hours tab. Posted shop hours were a
 * second, parallel answer to "when is this place open" that nothing in
 * the booking path consulted: a slot exists because a barber is rostered
 * on for it (staff_availability), not because the door is nominally
 * unlocked, and the two drifting apart only ever misled whoever read the
 * wrong one. So this tab shows the thing bookings are actually made
 * from, and only that — the staff schedules for the people on *this*
 * roster.
 *
 * Deliberately not an account-wide view: no location filter, because the
 * location is the thing you already picked to get here. It is the same
 * editor as Settings › Availability (StaffAvailabilityEditor), reached
 * with the roster pre-narrowed.
 */
export function LocationAvailabilityTab({ location }: { location: AccountLocation }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has, staffUser, isLoading: permissionsLoading } = usePermissions();
  const canManage = has("staff.manage");

  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ["location-staff", location.id],
    queryFn: () => listLocationStaff(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  /**
   * Who can actually hold a schedule here.
   *
   * Both flags are needed, and `claimed` is the one that matters: a
   * staff_users row is isActive from the moment the invite is created, so
   * filtering on isActive alone left unclaimed invites in this picker —
   * offering to set working hours for someone who cannot sign in, will
   * not appear as a calendar column (bookings.service.ts's
   * listStaffForLocation excludes them on the same check) and cannot be
   * booked. Deactivated members are excluded for the plainer reason.
   */
  const schedulable = useMemo(
    () => (staffQuery.data?.staff ?? []).filter((member) => member.isActive && member.claimed),
    [staffQuery.data],
  );

  /** Invited-but-unclaimed members, kept apart so the empty state can say where they went. */
  const invited = useMemo(
    () => (staffQuery.data?.staff ?? []).filter((member) => member.isActive && !member.claimed),
    [staffQuery.data],
  );

  // A non-manager may only read their own schedule (see
  // availability.service.ts's assertAvailabilityAccess), so don't offer
  // them a roster they'd only get 403s from.
  const viewableStaff = useMemo(
    () => (canManage ? schedulable : schedulable.filter((member) => member.id === staffUser?.id)),
    [canManage, schedulable, staffUser],
  );

  // Start on whoever's first on the roster — or on yourself if you're on
  // it, since a barber checking this tab is almost always checking their
  // own week. Re-points if the roster changes underneath the selection.
  useEffect(() => {
    if (viewableStaff.length === 0) return;
    if (viewableStaff.some((member) => member.id === selectedStaffUserId)) return;
    const self = viewableStaff.find((member) => member.id === staffUser?.id);
    setSelectedStaffUserId(self?.id ?? viewableStaff[0]?.id ?? null);
  }, [viewableStaff, selectedStaffUserId, staffUser]);

  if (staffQuery.isPending || permissionsLoading) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading availability…</p>;
  }
  if (staffQuery.isError) {
    return (
      <p className="m-0 font-sans text-sm text-tn-danger">
        Couldn&rsquo;t load this location&rsquo;s availability.
      </p>
    );
  }

  const withHours = schedulable.filter((member) => member.hasHours).length;
  const selectedMember = viewableStaff.find((member) => member.id === selectedStaffUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Staff availability</p>
        <p className="m-0 font-sans text-xs text-tn-muted-5">
          When the people who work here can be booked. This is what the booking page offers
          customers — {withHours} of {schedulable.length}{" "}
          {schedulable.length === 1 ? "person has" : "people have"} hours set.
          {invited.length > 0 &&
            ` ${invited.length} more ${invited.length === 1 ? "hasn't" : "haven't"} signed in yet and can't be scheduled.`}
        </p>
      </div>

      {schedulable.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
          {invited.length > 0 ? (
            <>
              {invited.length === 1
                ? `${invited[0]!.name} hasn't signed in yet`
                : `${invited.length} people here haven't signed in yet`}
              , so there&rsquo;s no schedule to set. Hours can be added once they&rsquo;ve claimed
              their invite.
            </>
          ) : (
            <>
              Nobody works here yet — assign someone in{" "}
              <Link to="/settings/staff" className="font-semibold text-tn-ink">
                Staff Management
              </Link>{" "}
              and their hours will show up here.
            </>
          )}
        </p>
      ) : viewableStaff.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
          Only a manager can see other people&rsquo;s schedules. Yours is in{" "}
          <Link to="/settings/hours" className="font-semibold text-tn-ink">
            Settings › Availability
          </Link>
          .
        </p>
      ) : (
        selectedStaffUserId && (
          <>
            {/* Who you're editing, stated up front — the editor below is
                identical for everyone, so without this the only difference
                between two people's screens is the numbers in the rows. */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tn-border bg-tn-table-head px-4 py-3">
              {selectedMember && (
                <MemberIdentity
                  member={selectedMember}
                  isSelf={selectedMember.id === staffUser?.id}
                />
              )}
              {viewableStaff.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[11px] text-tn-muted-5">
                    {viewableStaff.length} people on this roster
                  </span>
                  <StaffFilterPopover
                    staff={viewableStaff}
                    value={selectedStaffUserId}
                    onChange={setSelectedStaffUserId}
                    selfId={staffUser?.id}
                    label="Switch member"
                  />
                </div>
              )}
            </div>

            <StaffAvailabilityEditor
              // Remounts per member so an unsaved edit can never carry over
              // onto the next person's week.
              key={selectedStaffUserId}
              staffUserId={selectedStaffUserId}
              heading="Weekly hours"
            />
          </>
        )
      )}
    </div>
  );
}

export default LocationAvailabilityTab;
