import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { env } from "@/lib/env";
import type { AccountLocation } from "@/lib/locations-api";

interface QrCodeModalProps {
  location: AccountLocation | null;
  onClose: () => void;
}

/** Where a scan should land. Null when no public booking site is configured — see env.ts's VITE_BOOKING_BASE_URL. */
function bookingUrlFor(location: AccountLocation): string | null {
  const base = env.VITE_BOOKING_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/l/${location.id}`;
}

function fileNameFor(location: AccountLocation): string {
  return `${location.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-booking-qr`;
}

/**
 * A real, scannable code for one location, rendered as SVG so it prints
 * and scales without going fuzzy on a shop window.
 *
 * This replaces a crosshatch placeholder that only looked like a QR. The
 * placeholder was honest at the time — there was nothing to encode — but
 * it was download-and-printable, which made it a code that could end up
 * on a counter leading nowhere. Now the code is genuine, and when there's
 * no destination configured the panel says so instead of producing one.
 *
 * Error correction is set to M: enough redundancy to survive a scuffed
 * printout without inflating the module count so far that the code needs
 * to be large to scan.
 */
export function QrCodeModal({ location, onClose }: QrCodeModalProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = location ? bookingUrlFor(location) : null;

  useEffect(() => {
    if (!url) {
      setSvg(null);
      setError(null);
      return;
    }
    let cancelled = false;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 240 })
      .then((markup) => {
        if (!cancelled) {
          setSvg(markup);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't generate the code — try reopening this panel.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleDownload() {
    if (!location || !svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${fileNameFor(location)}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  function handlePrint() {
    if (!location || !svg) return;
    // A scoped window rather than window.print(): printing in place would
    // put the whole settings page behind the panel on the paper.
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) return;
    printWindow.document.write(
      `<title>${location.name} — booking QR</title>` +
        `<body style="font-family:sans-serif;text-align:center;padding:32px">` +
        svg +
        `<p style="font-size:14px;margin-top:16px">${location.name}</p>` +
        `<p style="font-size:11px;color:#777">${url ?? ""}</p>` +
        `</body>`,
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <Modal open={location !== null} onClose={onClose} width={380}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">Booking QR code</h2>
            <p className="m-0 font-sans text-xs text-tn-muted-5">{location?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer border-none bg-transparent font-sans text-base text-tn-muted-5"
          >
            ×
          </button>
        </div>

        {url === null && (
          <div className="rounded-xl border border-tn-gold bg-tn-gold-bg p-3.5">
            <p className="m-0 font-sans text-xs leading-relaxed text-tn-ink-soft">
              No public booking site is configured yet, so there&rsquo;s nothing for a scan to open.
              Set <code className="font-mono text-[11px]">VITE_BOOKING_BASE_URL</code> and this will
              generate a real code pointing at this location.
            </p>
          </div>
        )}

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        {svg && (
          <>
            <div
              className="flex items-center justify-center rounded-xl border border-tn-border bg-white p-4"
              // The library returns a complete, self-contained <svg> string
              // built from the URL above — no user-authored markup reaches
              // this, so there's nothing here for an injection to ride in on.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="m-0 text-center font-sans text-[11px] break-all text-tn-muted-5">{url}</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={handleDownload}>
                Download SVG
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                Print
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default QrCodeModal;
