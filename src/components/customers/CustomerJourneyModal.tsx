import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuthStore } from "@/auth/auth-store";
import {
  getCustomer,
  type Customer,
  type CustomerJourneyEntry,
  type BookingStatus,
} from "@/lib/customers-api";

interface CustomerJourneyModalProps {
  /** null closes the modal — same "undefined/null open state doubles as the value" pattern as ServicesPage's ServiceModal. */
  customer: Customer | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Booked",
  walk_in: "Walk-in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function journeyDetail(entry: CustomerJourneyEntry): string {
  const price = entry.priceCents === null ? "—" : dollars(entry.priceCents);
  return `With ${entry.staffName} · ${price} · ${STATUS_LABEL[entry.status]}`;
}

/** Matches the mockup's T10d Customer Journey panel — the stats box and timeline are now real (see customers-api.ts's getCustomer), pulled from this customer's actual booking history instead of a hardcoded example. */
export function CustomerJourneyModal({ customer, onClose }: CustomerJourneyModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const detailQuery = useQuery({
    queryKey: ["customer", customer?.id],
    queryFn: () => getCustomer(accessToken ?? "", customer!.id),
    enabled: !!accessToken && customer !== null,
  });
  const journey = detailQuery.data?.journey ?? [];
  // Falls back to the row already in hand (from the Customers list) while
  // this call is in flight, so the header/stats box isn't empty for a
  // beat every time a different customer is opened.
  const detail = detailQuery.data?.customer ?? customer;

  return (
    <Modal open={customer !== null} onClose={onClose} width={520}>
      {customer && detail && (
        <>
          <div className="flex items-start justify-between px-6 pt-6">
            <div>
              <p className="m-0 font-sans text-lg font-semibold text-tn-ink">{detail.name}</p>
              <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                {detail.phone || detail.email || "No contact on file"} · Customer since{" "}
                {new Date(detail.memberSince).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
            {detail.tag && (
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="gold">{detail.tag}</StatusPill>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 rounded-2xl border border-tn-border p-4 text-center">
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">{detail.visits}</p>
                <span className="font-sans text-[11px] text-tn-muted-5">visits</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  {dollars(detail.lifetimeSpendCents)}
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">lifetime spend</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  {detail.avgTicketCents === null ? "—" : dollars(detail.avgTicketCents)}
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">avg ticket</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  {detail.avgWeeksBetweenVisits === null
                    ? "—"
                    : `${detail.avgWeeksBetweenVisits} wks`}
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">avg between visits</span>
              </div>
            </div>

            <div>
              <p className="m-0 mb-3 font-sans text-sm font-semibold text-tn-ink">Journey</p>
              {detailQuery.isPending && (
                <p className="m-0 font-sans text-[13px] text-tn-muted-5">Loading history…</p>
              )}
              {!detailQuery.isPending && journey.length === 0 && (
                <p className="m-0 font-sans text-[13px] text-tn-muted-5">
                  No bookings yet — this customer&rsquo;s first visit will show up here.
                </p>
              )}
              <div className="flex flex-col gap-4">
                {journey.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 flex-none rounded-full bg-tn-gold" />
                      {i < journey.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-tn-border-softer" />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                        {formatDate(event.date)} · {event.serviceName}
                      </p>
                      <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                        {journeyDetail(event)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              {detail.email ? (
                <a
                  href={`mailto:${detail.email}`}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-[10px] border border-tn-input-border bg-transparent px-[18px] py-[11px] font-sans text-[13px] font-semibold text-tn-ink-soft hover:bg-tn-page"
                >
                  Message
                </a>
              ) : (
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled
                  title="No email on file for this customer"
                >
                  Message
                </Button>
              )}
              <Button
                className="flex-1"
                disabled
                title="Book from the Calendar page for now — quick-booking from here isn't wired up yet"
              >
                Book Appointment
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default CustomerJourneyModal;
