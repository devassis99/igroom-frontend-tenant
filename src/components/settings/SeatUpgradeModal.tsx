import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface SeatUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

/** Matches the mockup's T12g2 "Add New Member · Seat Upgrade" modal — shown before the wizard when the team is at its seat cap. */
export function SeatUpgradeModal({ open, onClose, onUpgrade }: SeatUpgradeModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">
          Add New Member · Seat Upgrade
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

      <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
        <p className="m-0 font-sans text-[13px] text-tn-muted-4">
          Jordan Rivera would be your 5th team member — one more than the Business Plan includes.
        </p>

        <div className="flex items-center justify-between rounded-xl bg-tn-page px-4 py-3">
          <span className="font-sans text-[13px] font-semibold text-tn-ink">4 of 4 seats used</span>
          <span className="font-sans text-xs text-tn-muted-5">· Business Plan · $12/seat/mo</span>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-tn-gold bg-tn-gold-bg-soft p-3.5">
          <span aria-hidden>ℹ</span>
          <p className="m-0 font-sans text-[13px] text-tn-ink-soft">
            This adds a 5th seat to your plan
          </p>
        </div>

        <div className="flex flex-col gap-2 font-sans text-[13px] text-tn-muted-3">
          <div className="flex justify-between">
            <span>New seat · $12/mo</span>
            <span>$12.00</span>
          </div>
          <div className="flex justify-between">
            <span>Prorated for 18 days left in cycle</span>
            <span>$7.20</span>
          </div>
          <div className="flex justify-between border-t border-tn-border-soft pt-2 font-semibold text-tn-ink">
            <span>Due today</span>
            <span>$7.20</span>
          </div>
        </div>

        <p className="m-0 font-sans text-xs text-tn-muted-5">
          Your next full invoice will include 5 seats at $12/mo each.
        </p>

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onUpgrade}>
            Upgrade Seat &amp; Continue →
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SeatUpgradeModal;
