import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";

const HOURS = [
  { label: "Monday – Friday", value: "9:00 AM – 8:00 PM" },
  { label: "Saturday", value: "9:00 AM – 6:00 PM" },
  { label: "Sunday", value: "Closed" },
];

/** Matches the mockup's T12b Hours & Availability page. */
export function HoursSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Hours &amp; Availability</h1>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        {HOURS.map((h, i) => (
          <div
            key={h.label}
            className={`flex items-center justify-between px-5 py-3.5 ${
              i < HOURS.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <span className="font-sans text-sm font-medium text-tn-ink-soft">{h.label}</span>
            <span className="font-sans text-sm text-tn-muted-3">{h.value}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Booking window</p>
        <Field label="HOW FAR AHEAD CLIENTS CAN BOOK">
          <input type="text" defaultValue="60 days" className={formInputClass} />
        </Field>
        <Field label="MINIMUM NOTICE">
          <input type="text" defaultValue="2 hours" className={formInputClass} />
        </Field>
        <Button className="w-fit">Save Changes</Button>
      </section>
    </div>
  );
}

export default HoursSettingsPage;
