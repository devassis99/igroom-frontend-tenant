import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { StaffAvailabilityEditor } from "@/components/availability/StaffAvailabilityEditor";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { StaffFilterPopover } from "@/components/ui/StaffFilterPopover";
import { listStaff } from "@/lib/staff-api";
import { listLocations } from "@/lib/locations-api";
import { TravelBufferField } from "@/components/availability/TravelBufferField";

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
 * Unpinned, so the editor draws its own tab strip: one tab per shop the
 * picked member works at, each with its own week in its own timezone.
 * The location filter above is still only a filter on *who* is listed —
 * it narrows the roster, it doesn't pick which shop's hours are shown,
 * which is what the editor's tabs are for.
 *
 * Kept out of this pass (see the chat thread this was scoped from):
 * "Create new availability" (several named schedules per member at one
 * shop, which is a different axis from the per-shop tabs) and the
 * reference's "Active on X events" / "Launch troubleshooter" / "Learn
 * more" controls, which don't correspond to any real iGroom feature.
 */
export function HoursSettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has, staffUser, isLoading: permissionsLoading } = usePermissions();
  const canManage = has("staff.manage");

  /**
   * `?staff=<id>` opens this page on somebody specific.
   *
   * Set by the collision panel on a location's Availability tab, which
   * can only edit the one shop it is pinned to and so sends a manager
   * here to see both sides of a clash. Landing on themselves instead of
   * on the member whose schedule is broken would make that link useless.
   */
  const [searchParams] = useSearchParams();
  const requestedStaffUserId = searchParams.get("staff");
  /** Which shop's tab to open on — the one the clash was raised at, so the link lands on the week that needs the edit. */
  const requestedLocationId = searchParams.get("shop");

  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(
    requestedStaffUserId,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");

  // Default the picker to "myself" the moment GET /accounts/me resolves —
  // everyone can always see their own schedule, so there's no reason to
  // make even a non-manager wait on the staff-list fetch below. A `staff`
  // param wins, since it is an explicit request rather than a default.
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
  // Only the branches this manager runs. The response carries the whole
  // account's shops so pickers elsewhere can name any of them, but
  // filtering by a branch whose staff and schedules this caller can't see
  // would just empty the page.
  const filterLocations = useMemo(
    () => (locationsQuery.data?.locations ?? []).filter((loc) => loc.inScope),
    [locationsQuery.data],
  );

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
            {/* The one setting behind the collision guard's travel half,
                put where a manager already thinks about hours rather
                than buried in a general settings page. */}
            <TravelBufferField />
            {/* Only worth showing when there is a choice to make. A
                manager who runs one branch has nothing to filter — "All
                locations" is their one shop under another name, and
                offering it implies the page is holding back shops they
                could switch to. The staff picker beside it is already
                narrowed to the same reach (listStaff is caller-scoped),
                so leaving the value at "all" with the control hidden
                shows exactly their branch. */}
            {filterLocations.length > 1 && (
              <LocationFilterPopover
                locations={filterLocations}
                value={selectedLocationId}
                onChange={setSelectedLocationId}
                label="Filter by location"
              />
            )}
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
        initialLocationId={requestedLocationId ?? undefined}
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
