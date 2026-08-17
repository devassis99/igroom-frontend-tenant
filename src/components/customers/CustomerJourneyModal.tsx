import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Customer } from "@/lib/sample-data";

interface CustomerJourneyModalProps {
  customer: Customer | null;
  onClose: () => void;
}

const JOURNEY = [
  {
    date: "Today",
    title: "Haircut & Beard Trim",
    detail: "With Marcus Webb · $65 · Booked via app",
  },
  {
    date: "Jun 28",
    title: "Left a 5-star review",
    detail: "“Marcus always nails the fade. In and out fast.”",
  },
  { date: "Jun 28", title: "Classic Haircut", detail: "With Marcus Webb · $45 · Booked via app" },
  {
    date: "May 3",
    title: "Classic Haircut",
    detail: "With Marcus Webb · $45 · Walk-in, joined via QR",
  },
  {
    date: "Jan 14, 2025",
    title: "First visit",
    detail: "Signed up on iGroom · booked via promo “New Client 20% Off”",
  },
];

/** Matches the mockup's T10d Customer Journey panel. */
export function CustomerJourneyModal({ customer, onClose }: CustomerJourneyModalProps) {
  return (
    <Modal open={customer !== null} onClose={onClose} width={520}>
      {customer && (
        <>
          <div className="flex items-start justify-between px-6 pt-6">
            <div>
              <p className="m-0 font-sans text-lg font-semibold text-tn-ink">{customer.name}</p>
              <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                {customer.contact} · Customer since {customer.memberSince}
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
            {(customer.tag || customer.notes.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {customer.tag && <StatusPill tone="gold">{customer.tag}</StatusPill>}
                {customer.notes.map((note) => (
                  <StatusPill key={note} tone="neutral">
                    {note}
                  </StatusPill>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 rounded-2xl border border-tn-border p-4 text-center">
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">{customer.visits}</p>
                <span className="font-sans text-[11px] text-tn-muted-5">visits</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  ${customer.lifetimeSpend}
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">lifetime spend</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  ${customer.avgTicket}
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">avg ticket</span>
              </div>
              <div>
                <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
                  {customer.avgWeeksBetweenVisits} wks
                </p>
                <span className="font-sans text-[11px] text-tn-muted-5">avg between visits</span>
              </div>
            </div>

            <div>
              <p className="m-0 mb-3 font-sans text-sm font-semibold text-tn-ink">Journey</p>
              <div className="flex flex-col gap-4">
                {JOURNEY.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 flex-none rounded-full bg-tn-gold" />
                      {i < JOURNEY.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-tn-border-softer" />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                        {event.date} · {event.title}
                      </p>
                      <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{event.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-tn-border-soft pt-3">
              <Button variant="secondary" className="flex-1">
                Message
              </Button>
              <Button className="flex-1">Book Appointment</Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default CustomerJourneyModal;
