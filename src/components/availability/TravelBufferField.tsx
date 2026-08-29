import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { updateSchedulingSettings } from "@/lib/collisions-api";

const OPTIONS = [0, 15, 30, 45, 60, 90];

/**
 * The account's travel buffer — minutes somebody needs between finishing
 * at one shop and starting at another.
 *
 * A single account-wide number rather than a matrix per pair of shops.
 * The accurate model is per-pair (Chauburji to Valencia is 35 minutes in
 * Lahore traffic; Valencia to Soho is a flight) and this is where that
 * would go, but a matrix needs a whole editor to be usable and one
 * default already catches the case that actually bites: two branches in
 * the same city booked back to back with no gap at all.
 *
 * "Off" is a real choice, and it only switches off the *travel* half of
 * the guard. Being bookable at two shops in the same moment stays
 * refused — there is no coherent account preference for that.
 */
export function TravelBufferField() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { account } = usePermissions();
  const queryClient = useQueryClient();
  const saved = account?.locationChangeBufferMinutes ?? 30;
  const [value, setValue] = useState(saved);

  // Re-seed when /accounts/me lands (or changes elsewhere), but never
  // over a pick the user is in the middle of making.
  useEffect(() => {
    setValue(saved);
  }, [saved]);

  const mutation = useMutation({
    mutationFn: (minutes: number) => updateSchedulingSettings(accessToken ?? "", minutes),
    onSuccess: () => {
      // The buffer is an input to every collision decision, so the last
      // sweep's findings and any refusal already on screen were judged
      // against the old number.
      queryClient.invalidateQueries({ queryKey: ["me", "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["collisions"] });
    },
    onError: () => setValue(saved),
  });

  return (
    <label className="flex items-center gap-2 rounded-xl border border-tn-input-border px-3 py-1.5">
      <span className="font-sans text-[11px] text-tn-muted-5">Travel between shops</span>
      <select
        value={value}
        disabled={mutation.isPending}
        onChange={(event) => {
          const next = Number(event.target.value);
          setValue(next);
          mutation.mutate(next);
        }}
        className="cursor-pointer border-none bg-transparent font-sans text-[13px] font-semibold text-tn-ink outline-none"
      >
        {OPTIONS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes === 0 ? "Don’t warn" : `${minutes} min`}
          </option>
        ))}
      </select>
    </label>
  );
}

export default TravelBufferField;
