import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** How long the slide/fade transition takes, in ms — kept in one place so the exit timer (below) can wait for it before actually unmounting. */
const TRANSITION_MS = 220;

function CheckCircleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

interface SuccessToastProps {
  message: string;
  onDismiss: () => void;
  /** ms before auto-dismiss; pass 0 to require the user to click the × instead. Defaults to 3000. */
  duration?: number;
}

/**
 * Fire-and-forget success banner for "your save went through" confirmations
 * (Availability's Save Changes, and anywhere else that wants the same green
 * pop-up). Portaled to document.body — same pattern as AccountMenu.tsx /
 * WhatsNewDrawer.tsx — so it always renders above the page regardless of
 * which panel or scroll container triggered it, and can't get clipped by an
 * ancestor's overflow like those two were before their fix.
 *
 * Render this conditionally from the caller (e.g. only while a `toast`
 * state string is set) rather than keeping it mounted permanently — see
 * HoursSettingsPage.tsx's saveMutation.onSuccess for the reference usage.
 */
export function SuccessToast({ message, onDismiss, duration = 3000 }: SuccessToastProps) {
  // Starts off-screen/hidden, then flips to visible a tick after mount so
  // the transition classes below actually animate in (mounting already
  // "visible" would just paint it in its final state with nothing to
  // transition from). `dismissing` drives the mirror-image exit — we ask
  // the parent to unmount us only after that animation has had time to
  // play, rather than yanking the toast out mid-transition.
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(onDismiss, TRANSITION_MS);
  }, [onDismiss]);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, dismiss]);

  const shown = visible && !dismissing;

  return createPortal(
    // <output> is the semantic element for "result of an action" and
    // implies role="status" on its own — oxlint's jsx-a11y/prefer-tag-over-role
    // flags a bare role="status" div in favor of it.
    <output
      aria-live="polite"
      className={`fixed top-5 left-1/2 z-50 flex items-center gap-2.5 rounded-full bg-tn-success/85 px-5 py-2.5 text-tn-on-dark shadow-lg backdrop-blur-sm transition-all duration-200 ease-out ${
        shown
          ? "translate-x-[-50%] translate-y-0 opacity-100"
          : "translate-x-[-50%] -translate-y-3 opacity-0"
      }`}
    >
      <CheckCircleIcon />
      <span className="font-sans text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-1 cursor-pointer border-none bg-transparent p-0.5 text-base leading-none opacity-80 hover:opacity-100"
      >
        ×
      </button>
    </output>,
    document.body,
  );
}

export default SuccessToast;
