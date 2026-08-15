import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { QrCodeModal } from "@/components/settings/QrCodeModal";
import { LOCATIONS, type Location } from "@/lib/sample-data";

const TOTAL_SEATS = 8;
const USED_SEATS = 7;

/** Matches the mockup's T12d Locations page + T12d2 QR code modal. */
export function LocationsSettingsPage() {
  const [qrLocation, setQrLocation] = useState<Location | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Locations</h1>
        <Button>+ Add Location</Button>
      </div>
      <p className="m-0 -mt-3 font-sans text-xs text-tn-muted-5">
        {LOCATIONS.length} locations · {USED_SEATS} of {TOTAL_SEATS} seats used · Business Plan ·
        $12/seat/mo, billed per location
      </p>

      <div className="flex flex-col gap-4">
        {LOCATIONS.map((loc) => (
          <div key={loc.id} className="flex flex-col gap-3 rounded-2xl border border-tn-border p-5">
            <div className="flex items-center justify-between">
              <p className="m-0 font-sans text-base font-semibold text-tn-ink">{loc.name}</p>
              <StatusPill tone="success">{loc.status}</StatusPill>
            </div>
            <p className="m-0 font-sans text-xs text-tn-muted-5">{loc.address}</p>
            <div className="flex gap-6 font-sans text-xs text-tn-muted-4">
              <span>
                Staff <strong className="text-tn-ink">{loc.staffCount}</strong>
              </span>
              <span>
                Bookings today <strong className="text-tn-ink">{loc.bookingsToday}</strong>
              </span>
              <span>
                Revenue <strong className="text-tn-ink">${loc.revenueToday}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQrLocation(loc)}
              className="flex w-fit cursor-pointer items-center gap-1.5 border-none bg-transparent font-sans text-xs font-medium text-tn-gold"
            >
              🔑 View Waitlist QR Code
            </button>
          </div>
        ))}
      </div>

      <QrCodeModal location={qrLocation} onClose={() => setQrLocation(null)} />
    </div>
  );
}

export default LocationsSettingsPage;
