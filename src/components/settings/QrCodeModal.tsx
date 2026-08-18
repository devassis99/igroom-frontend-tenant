import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { AccountLocation } from "@/lib/locations-api";

interface QrCodeModalProps {
  location: AccountLocation | null;
  onClose: () => void;
}

/**
 * Matches the mockup's T12d2 "Waitlist QR Code" modal — including its own
 * crosshatch placeholder graphic (a static two-gradient pattern, not an
 * actual scannable code; there's no public customer-facing waitlist-join
 * page anywhere in this app yet for a real QR to point at). Download
 * saves that same pattern as a real SVG file; Print opens a small
 * print-ready window scoped to just this location's code, rather than
 * printing the whole settings page behind the modal.
 */
export function QrCodeModal({ location, onClose }: QrCodeModalProps) {
  function fileNameFor(loc: AccountLocation) {
    return `${loc.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-waitlist-qr`;
  }

  function handleDownload() {
    if (!location) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" fill="#fafaf8"/>
  <rect x="10" y="10" width="220" height="220" rx="12" fill="#fafaf8" stroke="#ddd7cd"/>
  <defs>
    <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#1a1712"/>
      <rect x="8" y="8" width="8" height="8" fill="#1a1712"/>
    </pattern>
  </defs>
  <rect x="20" y="20" width="200" height="200" rx="8" fill="url(#grid)"/>
  <text x="120" y="228" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#8a8072">${location.name}</text>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameFor(location)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!location) return;
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html>
<head>
<title>Waitlist QR — ${location.name}</title>
<style>
  body { font-family: "Work Sans", sans-serif; text-align: center; padding: 40px 24px; color: #1a1712; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { font-size: 12px; color: #6b6255; margin: 0 0 20px; }
  .code {
    width: 220px; height: 220px; margin: 0 auto;
    border: 1px solid #ddd7cd; border-radius: 12px;
    background-image:
      repeating-linear-gradient(0deg, #1a1712 0 8px, transparent 8px 16px),
      repeating-linear-gradient(90deg, #1a1712 0 8px, transparent 8px 16px);
    background-blend-mode: multiply;
    background-color: #fafaf8;
  }
  .footer { margin-top: 16px; font-size: 11px; color: #8a8072; }
</style>
</head>
<body>
  <h1>${location.name}</h1>
  <p>Scan to join the waitlist</p>
  <div class="code"></div>
  <p class="footer">Print and place at the front desk.</p>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    // document.write-based windows don't reliably fire load in every
    // browser — a short delay is simpler and more consistent here than
    // wiring an onload handler.
    setTimeout(() => printWindow.print(), 300);
  }

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
              className="h-[200px] w-[200px] rounded-xl border border-tn-border"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, var(--color-tn-ink) 0 8px, transparent 8px 16px), repeating-linear-gradient(90deg, var(--color-tn-ink) 0 8px, transparent 8px 16px)",
                backgroundBlendMode: "multiply",
                backgroundColor: "var(--color-tn-surface)",
              }}
              aria-hidden
            />
            <p className="m-0 text-center font-sans text-xs text-tn-muted-5">
              Print and place at the front desk. Each location has its own code and queue.
            </p>
            <div className="flex w-full gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={handleDownload}>
                Download
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                Print
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default QrCodeModal;
