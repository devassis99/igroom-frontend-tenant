import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Location } from "@/lib/sample-data";

interface QrCodeModalProps {
  location: Location | null;
  onClose: () => void;
}

/** Matches the mockup's T12d2 "Waitlist QR Code" modal. */
export function QrCodeModal({ location, onClose }: QrCodeModalProps) {
  return (
    <Modal open={location !== null} onClose={onClose}>
      {location && (
        <>
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="m-0 font-sans text-[19px] font-semibold text-tn-ink">
              Waitlist QR Code
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
          <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-5">
            <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{location.name}</p>
            <div
              className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-tn-border bg-tn-page font-mono text-xs text-tn-muted-5"
              aria-hidden
            >
              QR CODE
            </div>
            <p className="m-0 text-center font-sans text-xs text-tn-muted-5">
              Print and place at the front desk. Each location has its own code and queue.
            </p>
            <div className="flex w-full gap-2.5">
              <Button variant="secondary" className="flex-1">
                Download
              </Button>
              <Button className="flex-1">Print</Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default QrCodeModal;
