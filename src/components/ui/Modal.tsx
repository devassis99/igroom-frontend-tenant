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

/** How long the keyframe animations below run — keep in sync with the tn-sheet / tn-modal keyframe pairs in index.css. */
const ANIMATION_MS = 180;

/**
 * Same portal-to-body pattern as igroom-frontend-bo's Modal.tsx — rendering
 * in place would center "fixed inset-0" relative to AppShell's scrollable
 * content div instead of the actual viewport.
 *
 * Stays mounted for ANIMATION_MS after `open` goes false so the closing
 * animation gets to play; unmounting immediately would cut it off.
 *
 * The open/close animations are CSS keyframes (index.css's tn-sheet-in /
 * tn-modal-in and their -out pairs), not a transition between two React
 * states. A transition only fires if the browser painted the closed state
 * before the open one is applied, which from React means scheduling the
 * flip a frame or two later and hoping that holds. It does hold in
 * isolation — and stops holding as soon as something heavy mounts in the
 * same commit, which is exactly what the Locations sheet does with its
 * Leaflet map. A keyframe animation plays from its own `from` value the
 * moment the element is inserted, so there is nothing to get wrong.
 */
export function Modal({ open, onClose, children, width = 440, variant = "center" }: ModalProps) {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const timeout = setTimeout(() => setRendered(false), ANIMATION_MS);
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
  const panelIn = isSheet ? "tn-sheet-in" : "tn-modal-in";
  const panelOut = isSheet ? "tn-sheet-out" : "tn-modal-out";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-tn-backdrop backdrop-blur-[6px] ${
        isSheet ? "justify-end" : "items-center justify-center p-8"
      }`}
      style={{
        animation: open
          ? `tn-backdrop-in ${ANIMATION_MS}ms ease-out`
          : `tn-backdrop-out ${ANIMATION_MS}ms ease-in forwards`,
      }}
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
          animation: open
            ? `${panelIn} ${ANIMATION_MS}ms ease-out`
            : `${panelOut} ${ANIMATION_MS}ms ease-in forwards`,
        }}
        // A sheet is flush with the viewport edges it meets — its top,
        // bottom and right are the window, so rounding only the left
        // corners reads as a card that has drifted off-screen rather than
        // a panel attached to the side. The centred variant still rounds:
        // it's a card, floating clear of every edge.
        className={`flex flex-col overflow-y-auto bg-tn-surface ${
          isSheet ? "h-full max-w-full" : "max-h-full rounded-2xl"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
