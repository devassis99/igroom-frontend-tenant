import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { StaffAvailabilityEditor } from "@/components/availability/StaffAvailabilityEditor";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { StaffFilterPopover } from "@/components/ui/StaffFilterPopover";
import { listStaff } from "@/lib/staff-api";
import { listLocations } from "@/lib/locations-api";

/**
 * Settings > Availability — replaces the old static Hours & Availability
 * page (hardcoded display-only hours + a fake "Booking window" form,
 * neither backed by a real API) with a real per-staff-member editor.
 *
 * This page is now only the *picker*: who am I looking at (a location
 * filter and a member filter, both manager-only). The schedule itself —
 * weekly grid, copy-times, date overrides, save — lives in
 * StaffAvailabilityEditor,
 * shared with a location's Availability tab so the same editor answers
 * "this person's hours" wherever you reach it from.
 *
 * Kept out of this pass (see the chat thread this was scoped from):
 * multiple named schedules/tabs and "Create new availability" — iGroom
 * still has exactly one schedule per staff member; and the reference's
 * "Active on X events" / "Launch troubleshooter" / "Learn more"
 * controls, which don't correspond to any real iGroom feature.
 */
export function HoursSettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has, staffUser, isLoading: permissionsLoading } = usePermissions();
  const canManage = has("staff.manage");

  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");

  // Default the picker to "myself" the moment GET /accounts/me resolves —
  // everyone can always see their own schedule, so there's no reason to
  // make even a non-manager wait on the staff-list fetch below.
  useEffect(() => {
    if (!selectedStaffUserId && staffUser) setSelectedStaffUserId(staffUser.id);
  }, [selectedStaffUserId, staffUser]);

  // Only a manager ever sees or needs the staff picker — a Barber only
  // has permission to see their own schedule anyway (see
  // availability.service.ts's assertAvailabilityAccess), so there's
  // nothing for this query to back for them.
  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => listStaff(accessToken ?? ""),
    enabled: !!accessToken && canManage,
  });
  // Manager-gated for the same reason as staffQuery above: the location
  // filter it backs only renders for a manager.
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: !!accessToken && canManage,
  });

  const staffOptions = useMemo(() => {
    const all = staffQuery.data?.staff ?? [];
    // Only people who can actually hold a schedule. listStaff() backs the
    // Staff Management table, so it deliberately returns deactivated rows
    // and invites nobody has claimed yet — both need to be manageable
    // there. Neither can sign in, though, so offering to set working hours
    // for them puts someone on the rota who can't work it, and the
    // calendar (which filters on the same isActive + credentials pair in
    // bookings.service.ts's listStaffForLocation) would never show them.
    // The effect below re-points the selection if the current pick drops
    // out of this list.
    const schedulable = all.filter((s) => s.isActive && s.claimed);
    return selectedLocationId === "all"
      ? schedulable
      : schedulable.filter((s) => s.locations.some((loc) => loc.id === selectedLocationId));
  }, [staffQuery.data, selectedLocationId]);

  const selectedStaffMember = staffOptions.find((s) => s.id === selectedStaffUserId);

  // Switching the location filter can drop the currently-selected staff
  // member out of the list (they work at a different location) — fall
  // back to the first name still on screen rather than leaving the
  // picker pointed at a value with no matching option.
  useEffect(() => {
    const fallback = staffOptions[0];
    if (!fallback) return;
    if (!staffOptions.some((s) => s.id === selectedStaffUserId)) {
      setSelectedStaffUserId(fallback.id);
    }
  }, [staffOptions, selectedStaffUserId]);

  if (permissionsLoading || !selectedStaffUserId) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Availability</h1>
        <p className="m-0 font-sans text-sm text-tn-muted-5">Loading…</p>
      </div>
    );
  }

  const viewingSelf = selectedStaffUserId === staffUser?.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Availability</h1>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <LocationFilterPopover
              locations={locationsQuery.data?.locations ?? []}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              label="Filter by location"
            />
            <StaffFilterPopover
              staff={staffOptions}
              value={selectedStaffUserId ?? ""}
              onChange={setSelectedStaffUserId}
              selfId={staffUser?.id}
              label="Filter by member"
              emptyLabel="Nobody here has signed in yet — a member can be scheduled once they've claimed their invite."
            />
          </div>
        )}
      </div>

      <StaffAvailabilityEditor
        // Remounts on a different pick rather than relying on the
        // editor's own re-seeding effects, so no unsaved edit can ever
        // survive a switch and land on the wrong person's week.
        key={selectedStaffUserId}
        staffUserId={selectedStaffUserId}
        heading={
          viewingSelf
            ? "Set your availability"
            : `Set ${selectedStaffMember?.name ?? "this member"}'s availability`
        }
      />
    </div>
  );
}

export default HoursSettingsPage;
