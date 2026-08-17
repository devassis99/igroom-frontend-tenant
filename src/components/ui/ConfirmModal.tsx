import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  /** Disables both buttons and swaps the confirm label while the action is in flight. */
  confirming?: boolean;
  /** Red "danger" button for destructive actions (the default) vs. the normal dark button for anything else. */
  danger?: boolean;
}

/** Generic "are you sure" modal — delete confirmations across the app (services, categories, ...) share this instead of each rolling its own. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  confirming = false,
  danger = true,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} width={380}>
      <div className="flex flex-col gap-4 p-6">
        <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">{title}</h2>
        {body && <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-4">{body}</p>}
        <div className="flex gap-2.5 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
