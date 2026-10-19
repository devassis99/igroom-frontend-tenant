import { Button } from "@/components/ui/Button";
import type { AccountLocation, LocationSetupStep } from "@/lib/locations-api";
import { LOCATION_SETUP_STEPS } from "@/lib/location-setup";

/**
 * The "Setup needed" checklist that stands in front of a branch's booking
 * link and QR code until the branch can actually take a booking.
 *
 * A link handed out before then opens a page a customer can't book from
 * — no services, nobody to book, or every slot an hour out because the
 * branch has no timezone — and it's the owner's first customer who finds
 * out. So the link stays locked, and this says exactly what's left and
 * where to do it. Done steps stay on the list, ticked, so the owner can
 * see how close they are.
 */
export function LocationSetupGuide({
  location,
  onGo,
}: {
  location: Pick<AccountLocation, "setupMissing">;
  /** Jump to where a step is fixed. Omitted where there's nowhere to jump (the QR modal). */
  onGo?: (step: LocationSetupStep) => void;
}) {
  const remaining = location.setupMissing.length;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-tn-gold bg-tn-gold-bg px-3 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="m-0 font-sans text-xs font-semibold text-tn-ink">
          Setup needed · {remaining} {remaining === 1 ? "step" : "steps"} left
        </p>
        <p className="m-0 font-sans text-[12px] leading-relaxed text-tn-muted-4">
          The link and QR code unlock once this location can take a booking — until then a customer
          would land on a page they can&rsquo;t book from.
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {LOCATION_SETUP_STEPS.map((item) => {
          const missing = location.setupMissing.includes(item.step);
          return (
            <li key={item.step} className="flex gap-2">
              <span
                aria-hidden
                className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full font-sans text-[11px] font-bold ${
                  missing
                    ? "border border-tn-gold bg-tn-surface text-tn-gold"
                    : "bg-tn-success text-tn-surface"
                }`}
              >
                {missing ? "" : "✓"}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={`font-sans text-[12px] ${
                    missing ? "font-semibold text-tn-ink" : "text-tn-muted-5"
                  }`}
                >
                  {missing ? item.title : item.done}
                  <span className="sr-only">{missing ? " — to do" : " — done"}</span>
                </span>
                {missing && (
                  <>
                    <span className="font-sans text-[12px] leading-relaxed text-tn-muted-4">
                      {item.how}
                    </span>
                    {onGo && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="self-start"
                        onClick={() => onGo(item.step)}
                      >
                        {item.action}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default LocationSetupGuide;
