import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { listLocationStaff, type AccountLocation } from "@/lib/locations-api";

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-tn-avatar-tan font-sans text-[11px] font-semibold text-tn-ink">
      {initials}
    </span>
  );
}

/**
 * Who works at this location.
 *
 * Read-only on purpose: assigning people to locations, changing roles and
 * inviting new members all live in Staff Management, which has the whole
 * wizard for it. Duplicating a slice of that here would give an owner two
 * places to do the same job and one of them would drift.
 *
 * `hasHours` is the one thing this view adds — someone can be assigned
 * here and still be unbookable because nobody set their working hours,
 * which is otherwise only discoverable from an empty calendar column.
 * It's only shown for someone who could be booked in the first place: an
 * unclaimed invite is unbookable for a different and more basic reason,
 * and saying "No hours set" about them points at the wrong fix.
 */
export function LocationStaffTab({ location }: { location: AccountLocation }) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const staffQuery = useQuery({
    queryKey: ["location-staff", location.id],
    queryFn: () => listLocationStaff(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  if (staffQuery.isPending) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading the roster…</p>;
  }
  if (staffQuery.isError) {
    return <p className="m-0 font-sans text-sm text-tn-danger">Couldn&rsquo;t load the roster.</p>;
  }

  const staff = staffQuery.data.staff;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
            Roster · {staff.length} {staff.length === 1 ? "person" : "people"}
          </p>
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            Assign people to locations in Staff Management; this is who ends up here.
          </p>
        </div>
        <Link
          to="/settings/staff"
          className="rounded-lg border border-tn-input-border px-2.5 py-1.5 font-sans text-[11px] font-semibold text-tn-ink-soft no-underline hover:bg-tn-page"
        >
          Staff Management
        </Link>
      </div>

      {staff.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
          Nobody works here yet — this location can&rsquo;t take a booking until someone does.
        </p>
      ) : (
        <div className="rounded-2xl border border-tn-border">
          {staff.map((member, index) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                index < staff.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <Initials name={member.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-sans text-[13px] font-semibold text-tn-ink">
                  {member.name}
                </span>
                <span className="truncate font-sans text-[11px] text-tn-muted-5">
                  {[member.displayTitle ?? member.roleName, member.email]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {/* `claimed`, not `isActive` — a row is active from the moment
                  the invite is created, so isActive never said "Invited"
                  at all and this badge only ever showed for someone who
                  had been deactivated. */}
              {!member.claimed && (
                <span className="rounded-full bg-tn-neutral-bg px-2 py-0.5 font-sans text-[10px] font-semibold text-tn-muted-5">
                  Invited
                </span>
              )}
              {!member.isActive && (
                <span className="rounded-full bg-tn-neutral-bg px-2 py-0.5 font-sans text-[10px] font-semibold text-tn-muted-5">
                  Deactivated
                </span>
              )}
              {member.isActive && member.claimed && !member.hasHours && (
                <span className="rounded-full bg-tn-gold-bg px-2 py-0.5 font-sans text-[10px] font-semibold text-tn-gold">
                  No hours set
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LocationStaffTab;
