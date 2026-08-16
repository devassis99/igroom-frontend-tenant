import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Wider modals (e.g. the Staff Management wizard) opt into this instead of the 440px default. */
  width?: number;
}

/**
 * Same portal-to-body pattern as igroom-frontend-bo's Modal.tsx — rendering
 * in place would center "fixed inset-0" relative to AppShell's scrollable
 * content div instead of the actual viewport.
 */
export function Modal({ open, onClose, children, width = 440 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tn-backdrop p-8 backdrop-blur-[6px]"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- onClick here only stops the backdrop's onClose from firing when the modal content is clicked, not a real interactive control. */}
      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- swapping to native <dialog> needs a showModal/close + focus-trap rework of every call site, deferred.
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width, boxShadow: "0 30px 70px -20px rgba(20,15,5,0.5)" }}
        className="flex max-h-full flex-col overflow-y-auto rounded-2xl bg-tn-surface"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
