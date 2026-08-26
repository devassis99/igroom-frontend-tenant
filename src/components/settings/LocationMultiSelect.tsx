import type { AccountLocation } from "@/lib/locations-api";

/**
 * Which shops a staff member works at.
 *
 * A checkbox list rather than a multi-select `<select multiple>`: the
 * native control hides the fact that more than one row can be ticked
 * behind a ctrl-click nobody discovers, and an account has a handful of
 * locations, not hundreds. Same checkbox idiom as the Services step next
 * to it, so the two steps of the wizard read the same way.
 *
 * Replaces the single `<select>` this used to be — see the backend's
 * db/schema/staff-locations.ts for why one shop per person was wrong.
 */
export function LocationMultiSelect({
  locations,
  value,
  onChange,
  disabled = false,
  loading = false,
  unavailableReason,
}: {
  locations: AccountLocation[];
  value: string[];
  onChange: (locationIds: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Why a particular location can't be ticked right now, or undefined if
   * it can. Returning the reason rather than a boolean means the row can
   * say it in a tooltip instead of just going grey — a control that
   * refuses without explaining reads as broken.
   */
  unavailableReason?: (location: AccountLocation) => string | undefined;
}) {
  function toggle(locationId: string) {
    onChange(
      value.includes(locationId) ? value.filter((id) => id !== locationId) : [...value, locationId],
    );
  }

  if (loading && locations.length === 0) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading locations…</p>;
  }
  if (locations.length === 0) {
    return (
      <p className="m-0 font-sans text-sm text-tn-muted-5">
        No locations yet — add one before assigning staff.
      </p>
    );
  }

  return (
    <div className="flex max-h-52 flex-col overflow-y-auto rounded-xl border border-tn-input-border">
      {locations.map((loc, i) => {
        const checked = value.includes(loc.id);
        // A location already ticked is never blocked — otherwise the only
        // way to undo a selection would be to satisfy the rule it broke.
        const reason = checked ? undefined : unavailableReason?.(loc);
        const rowDisabled = disabled || reason !== undefined;
        return (
          <label
            key={loc.id}
            title={reason}
            // The visible text sits two spans deep (name + address), past
            // the depth jsx-a11y/label-has-associated-control walks, so
            // name the control explicitly rather than restructuring the
            // row around the linter.
            aria-label={loc.name}
            className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 hover:bg-tn-page ${
              i < locations.length - 1 ? "border-b border-tn-border-soft" : ""
            } ${rowDisabled ? "cursor-not-allowed opacity-55" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={rowDisabled}
              onChange={() => toggle(loc.id)}
              className="size-4 shrink-0 accent-tn-gold"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-sans text-[13px] font-medium text-tn-ink">
                {loc.name}
                {loc.isPrimary && (
                  <span className="ml-2 rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-[0.02em] text-tn-gold">
                    PRIMARY
                  </span>
                )}
              </span>
              <span className="truncate font-sans text-[11px] text-tn-muted-5">{loc.address}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default LocationMultiSelect;
