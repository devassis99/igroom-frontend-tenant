import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/TimePicker";
import { useAuthStore } from "@/auth/auth-store";
import {
  listLocationHours,
  setLocationHours,
  type AccountLocation,
  type LocationHoursDay,
} from "@/lib/locations-api";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday first for reading, even though the data is Sunday-indexed to match Date#getDay(). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "18:00";

/**
 * The shop's *posted* opening hours — when the doors are open, which is a
 * different question from when any individual barber is rostered on
 * (Settings > Availability, staff_availability). The marketplace shows
 * these on the shop profile and uses them for the "Open now" badge.
 *
 * location_hours has been in the schema since the marketplace work but
 * had no editor anywhere until this tab, so for most accounts every day
 * starts closed.
 */
export function LocationHoursTab({
  location,
  canManage,
}: {
  location: AccountLocation;
  canManage: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [days, setDays] = useState<LocationHoursDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoursQuery = useQuery({
    queryKey: ["location-hours", location.id],
    queryFn: () => listLocationHours(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  // Seeded from the server once per location, then owned locally so a day
  // can be edited without a round trip per keystroke. Keyed on the id as
  // well as the data so switching locations re-seeds.
  useEffect(() => {
    if (hoursQuery.data) setDays(hoursQuery.data.days);
  }, [hoursQuery.data]);

  const save = useMutation({
    mutationFn: (next: LocationHoursDay[]) =>
      setLocationHours(accessToken ?? "", location.id, next),
    onSuccess: (result) => {
      setDays(result.days);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["location-hours", location.id] });
      // Opening hours don't feed the ops table's figures, but "open now"
      // on the marketplace reads them — keep the shared cache honest.
      void queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't save hours"),
  });

  function update(dayOfWeek: number, patch: Partial<LocationHoursDay>) {
    setDays((current) =>
      (current ?? []).map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    );
  }

  if (hoursQuery.isPending || days === null) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading hours…</p>;
  }
  if (hoursQuery.isError) {
    return (
      <p className="m-0 font-sans text-sm text-tn-danger">
        Couldn&rsquo;t load this location&rsquo;s hours.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Opening hours</p>
        <p className="m-0 font-sans text-xs text-tn-muted-5">
          When this shop is open to customers. Separate from each barber&rsquo;s own working hours,
          which live in Settings &rsaquo; Availability.
        </p>
      </div>

      <div className="rounded-2xl border border-tn-border">
        {DISPLAY_ORDER.map((dayOfWeek, index) => {
          const day = days.find((d) => d.dayOfWeek === dayOfWeek);
          if (!day) return null;
          const isOpen = !day.isClosed;
          return (
            <div
              key={dayOfWeek}
              className={`flex items-center gap-3 px-4 py-3 ${
                index < DISPLAY_ORDER.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <button
                type="button"
                role="switch"
                aria-checked={isOpen}
                aria-label={`Toggle ${DAY_LABELS[dayOfWeek]}`}
                disabled={!canManage}
                onClick={() =>
                  update(dayOfWeek, {
                    isClosed: isOpen,
                    openTime: isOpen ? null : (day.openTime ?? DEFAULT_OPEN),
                    closeTime: isOpen ? null : (day.closeTime ?? DEFAULT_CLOSE),
                  })
                }
                // Same switch as ui/Toggle.tsx — see the colour note there.
                className={`relative h-[22px] w-9 flex-none cursor-pointer rounded-full border-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isOpen ? "bg-tn-success" : "bg-tn-border-softer"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-tn-surface transition-transform ${
                    isOpen ? "translate-x-[14px]" : "translate-x-0"
                  }`}
                />
              </button>

              <span className="w-24 flex-none font-sans text-[13px] font-medium text-tn-ink-soft">
                {DAY_LABELS[dayOfWeek]}
              </span>

              {isOpen ? (
                <div className="flex items-center gap-2">
                  <TimePicker
                    value={day.openTime ?? DEFAULT_OPEN}
                    onChange={(openTime) => update(dayOfWeek, { openTime })}
                    label={`${DAY_LABELS[dayOfWeek]} opening time`}
                  />
                  <span className="font-sans text-xs text-tn-muted-5">–</span>
                  <TimePicker
                    value={day.closeTime ?? DEFAULT_CLOSE}
                    onChange={(closeTime) => update(dayOfWeek, { closeTime })}
                    label={`${DAY_LABELS[dayOfWeek]} closing time`}
                  />
                </div>
              ) : (
                <span className="font-sans text-[13px] text-tn-muted-5">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="m-0 font-sans text-sm text-tn-danger">{error}</p>}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(days)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save hours"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default LocationHoursTab;
