import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { staffAvatarColorStrong } from "@/lib/staff-avatar-color";
import type { WaitlistChair, WaitingEntry } from "@/lib/waitlist-api";

interface SeatChairModalProps {
  entry: WaitingEntry | null;
  chairs: WaitlistChair[];
  onClose: () => void;
  onSeat: (staffUserId: string) => void;
  pending: boolean;
  error: string | null;
}

/**
 * Which chair, when the desk sits somebody down.
 *
 * A step rather than a one-tap "Seat" for two reasons. Most entries say
 * "any barber" — the queue never picked one, so somebody has to — and
 * seating creates a real booking against that person, which is a write
 * to the calendar and the day's takings, not a status flip. Open chairs
 * sort first because that is the only question the desk is actually
 * asking.
 */
export function SeatChairModal({
  entry,
  chairs,
  onClose,
  onSeat,
  pending,
  error,
}: SeatChairModalProps) {
  if (!entry) return null;

  const sorted = [...chairs].sort((a, b) => {
    // The barber they asked for goes first even if busy, so the desk can
    // see they're occupied rather than wondering why the name is missing.
    if (entry.staffUserId) {
      if (a.staffUserId === entry.staffUserId) return -1;
      if (b.staffUserId === entry.staffUserId) return 1;
    }
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Modal open={entry !== null} onClose={onClose}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">
          Seat {entry.customerName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer border-none bg-transparent font-sans text-xl text-tn-muted-6"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
        <p className="m-0 font-sans text-[13px] text-tn-muted-5">
          {entry.serviceName} · {entry.durationMinutes} min
          {entry.staffUserId ? ` · asked for ${entry.staffName}` : " · no barber preference"}
        </p>

        <div className="flex flex-col gap-2">
          {sorted.map((chair) => (
            <button
              key={chair.staffUserId}
              type="button"
              disabled={!chair.isOpen || pending}
              onClick={() => onSeat(chair.staffUserId)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${
                chair.isOpen
                  ? "border-tn-input-border bg-tn-surface hover:border-tn-gold"
                  : "cursor-not-allowed border-tn-border-soft bg-tn-page opacity-60"
              }`}
            >
              <Avatar initials={chair.initials} color={staffAvatarColorStrong(chair.staffUserId)} />
              <span className="flex-1">
                <span className="block font-sans text-[13px] font-semibold text-tn-ink">
                  {chair.name}
                </span>
                <span className="block font-sans text-xs text-tn-muted-5">
                  {chair.isOpen
                    ? "Open — ready for next"
                    : `Busy with ${chair.current?.customerName ?? "a client"}`}
                </span>
              </span>
              {chair.isOpen ? (
                <span className="font-sans text-xs font-semibold text-tn-gold">Seat here</span>
              ) : null}
            </button>
          ))}
        </div>

        {chairs.every((chair) => !chair.isOpen) ? (
          <p className="m-0 rounded-xl bg-tn-page p-3 font-sans text-xs text-tn-muted-3">
            Every chair is busy. Seating anyway would double-book somebody — wait for one to free
            up, or finish a visit first.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="m-0 font-sans text-[13px] text-tn-danger">
            {error}
          </p>
        ) : null}

        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export default SeatChairModal;
