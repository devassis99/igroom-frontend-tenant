import { Link } from "react-router";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuthStore } from "@/auth/auth-store";
import { LOCATIONS, TODAY_SCHEDULE, type Appointment } from "@/lib/sample-data";

const STATUS_TONE: Record<Appointment["status"], "success" | "neutral"> = {
  Confirmed: "success",
  "In chair": "success",
  Waiting: "neutral",
};

/** Matches the mockup's T6 Owner Dashboard frame. */
export function DashboardPage() {
  const owner = useAuthStore((s) => s.owner);
  const firstName = owner?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">
          Good morning, {firstName}
        </h1>
        <Button>+ Add Booking</Button>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Today's bookings" value="14" />
        <StatCard label="In waitlist now" value="3" />
        <StatCard label="Revenue today" value="$612" />
        <StatCard label="Rating" value="4.9" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="m-0 font-sans text-base font-semibold text-tn-ink">Today&rsquo;s schedule</p>
          <Link to="/calendar" className="font-sans text-[13px] font-medium text-tn-gold">
            View calendar
          </Link>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          {TODAY_SCHEDULE.map((apt, i) => (
            <div
              key={apt.id}
              className={`flex items-center gap-4 px-[18px] py-3.5 ${
                i < TODAY_SCHEDULE.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="w-[70px] flex-none font-sans text-[13px] font-semibold text-tn-ink-soft">
                {apt.time}
              </span>
              <Avatar initials="" color={apt.avatarColor} />
              <div className="flex-1">
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                  {apt.customer} · {apt.service}
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">with {apt.barber}</p>
              </div>
              <StatusPill tone={STATUS_TONE[apt.status]}>{apt.status}</StatusPill>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="m-0 font-sans text-base font-semibold text-tn-ink">By location</p>
          <Link to="/settings/locations" className="font-sans text-[13px] font-medium text-tn-gold">
            View locations
          </Link>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
            <span>Location</span>
            <span>Bookings</span>
            <span>Waitlist</span>
            <span>Revenue</span>
          </div>
          {LOCATIONS.map((loc, i) => (
            <div
              key={loc.id}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-[18px] py-3.5 ${
                i < LOCATIONS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="font-sans text-[13px] font-semibold text-tn-ink">{loc.name}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">{loc.bookingsToday}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {loc.id === "downtown" ? 3 : 1}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">${loc.revenueToday}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
