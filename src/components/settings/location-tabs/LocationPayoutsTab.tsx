import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { getLocationPayouts, type AccountLocation } from "@/lib/locations-api";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  requires_payment: "Awaiting payment",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-tn-border px-4 py-3">
      <span className="font-sans text-lg font-semibold text-tn-ink">{value}</span>
      <span className="font-sans text-[11px] font-semibold tracking-[0.04em] text-tn-muted-5">
        {label.toUpperCase()}
      </span>
      {hint && <span className="font-sans text-[11px] text-tn-faint">{hint}</span>}
    </div>
  );
}

/**
 * What this location took, and what it's still owed.
 *
 * Deliberately not a payout schedule. Nothing in this codebase models
 * transfers to a shop's own bank account — there's no payouts table, no
 * Stripe Connect account, no schedule — so this tab reports the money
 * that demonstrably moved (booking_payments, written by the marketplace
 * checkout's webhook) and the money that hasn't. Inventing a "next payout
 * on Friday" line from nothing would be worse than the tab not existing.
 */
export function LocationPayoutsTab({ location }: { location: AccountLocation }) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const payoutsQuery = useQuery({
    queryKey: ["location-payouts", location.id],
    queryFn: () => getLocationPayouts(accessToken ?? "", location.id),
    enabled: !!accessToken,
  });

  if (payoutsQuery.isPending) {
    return <p className="m-0 font-sans text-sm text-tn-muted-5">Loading takings…</p>;
  }
  if (payoutsQuery.isError) {
    return <p className="m-0 font-sans text-sm text-tn-danger">Couldn&rsquo;t load takings.</p>;
  }

  const { totals, payments, windowDays } = payoutsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
          Last {windowDays} days at {location.name}
        </p>
        <p className="m-0 font-sans text-xs text-tn-muted-5">
          Money taken through the app. Bank transfers aren&rsquo;t connected yet, so nothing here is
          a payout date — it&rsquo;s what was booked, what Stripe captured, and what&rsquo;s still
          to collect in the chair.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Booked" value={money(totals.bookedCents)} hint="Total price of appointments" />
        <Stat
          label="Captured online"
          value={money(totals.capturedCents)}
          hint="Paid through checkout"
        />
        <Stat
          label="To collect"
          value={money(totals.outstandingCents)}
          hint="Deposits' balance + in-person bookings"
        />
        <Stat label="Refunded" value={money(totals.refundedCents)} />
      </div>

      {payments.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-tn-border px-4 py-6 text-center font-sans text-sm text-tn-muted-5">
          No online payments here yet — every booking at this location was taken in person.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-tn-border">
          <div style={{ minWidth: 620 }}>
            <div className="grid grid-cols-[110px_1fr_1fr_90px_100px] gap-3 border-b border-tn-border-softer bg-tn-table-head px-4 py-2.5">
              {["DATE", "CUSTOMER", "SERVICE", "CAPTURED", "STATUS"].map((heading) => (
                <span
                  key={heading}
                  className="font-sans text-[11px] font-semibold tracking-[0.05em] text-tn-muted-5"
                >
                  {heading}
                </span>
              ))}
            </div>
            {payments.map((payment, index) => (
              <div
                key={payment.bookingId}
                className={`grid grid-cols-[110px_1fr_1fr_90px_100px] items-center gap-3 px-4 py-3 ${
                  index < payments.length - 1 ? "border-b border-tn-border-soft" : ""
                }`}
              >
                <span className="font-sans text-xs text-tn-muted-5">
                  {new Date(payment.startAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="truncate font-sans text-[13px] text-tn-ink">
                  {payment.customerName}
                </span>
                <span className="truncate font-sans text-[13px] text-tn-muted-5">
                  {payment.serviceName}
                </span>
                <span className="font-sans text-[13px] text-tn-ink">
                  {money(payment.capturedCents)}
                  {payment.remainingCents > 0 && (
                    <span className="block font-sans text-[10px] text-tn-gold">
                      {money(payment.remainingCents)} due
                    </span>
                  )}
                </span>
                <span className="font-sans text-[11px] text-tn-muted-5">
                  {payment.status ? (STATUS_LABELS[payment.status] ?? payment.status) : "—"}
                  {payment.type === "deposit" && " · deposit"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationPayoutsTab;
