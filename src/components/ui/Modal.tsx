import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Wider modals (e.g. the Staff Management wizard) opt into this instead of the 440px default. */
  width?: number;
  /**
   * "sheet" slides in from the right edge, full height, instead of rising
   * in the centre. Used by Locations so the list stays on screen while you
   * add or edit a site — you can see the row you're changing and the ones
   * you're copying settings from.
   */
  variant?: "center" | "sheet";
}

/** Matches the backdrop-fade + panel-rise duration below — keep these two in sync. */
const TRANSITION_MS = 180;

/**
 * Same portal-to-body pattern as igroom-frontend-bo's Modal.tsx — rendering
 * in place would center "fixed inset-0" relative to AppShell's scrollable
 * content div instead of the actual viewport.
 *
 * Stays mounted for one extra tick on both ends of `open` so the
 * backdrop-fade/panel-rise transition actually gets to run: mounting
 * `open`+"entering" in the same paint would let the browser coalesce the
 * two states and skip straight to the end value, and unmounting the
 * instant `open` goes false would cut the close animation off before it's
 * visible.
 */
export function Modal({ open, onClose, children, width = 440, variant = "center" }: ModalProps) {
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timeout = setTimeout(() => setRendered(false), TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  const isSheet = variant === "sheet";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-tn-backdrop backdrop-blur-[6px] transition-opacity ease-out ${
        isSheet ? "justify-end" : "items-center justify-center p-8"
      }`}
      style={{ transitionDuration: `${TRANSITION_MS}ms`, opacity: entered ? 1 : 0 }}
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- onClick here only stops the backdrop's onClose from firing when the modal content is clicked, not a real interactive control. */}
      <div
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- swapping to native <dialog> needs a showModal/close + focus-trap rework of every call site, deferred.
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          boxShadow: isSheet
            ? "-24px 0 60px -30px rgba(20,15,5,0.45)"
            : "0 30px 70px -20px rgba(20,15,5,0.5)",
          transitionDuration: `${TRANSITION_MS}ms`,
          // A sheet slides rather than rises, and stays opaque throughout:
          // fading a full-height panel in place reads as a flicker at this
          // size, where a 440px card in the middle of the screen doesn't.
          opacity: isSheet ? 1 : entered ? 1 : 0,
          transform: isSheet
            ? `translateX(${entered ? "0" : "100%"})`
            : entered
              ? "translateY(0) scale(1)"
              : "translateY(10px) scale(0.97)",
        }}
        className={`flex flex-col overflow-y-auto bg-tn-surface transition-[opacity,transform] ease-out ${
          isSheet ? "h-full max-w-full rounded-l-2xl" : "max-h-full rounded-2xl"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
