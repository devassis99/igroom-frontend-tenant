import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { STAFF } from "@/lib/sample-data";

const BARBERS = STAFF.filter((s) => s.role === "Senior Barber" || s.role === "Barber");
const TEAM_SALES = BARBERS.reduce((sum, s) => sum + s.sales, 0);
const AVG_TICKET = TEAM_SALES / BARBERS.reduce((sum, s) => sum + s.bookings, 0);
const AVG_UTILIZATION = Math.round(
  BARBERS.reduce((sum, s) => sum + s.utilization, 0) / BARBERS.length,
);
const TOTAL_COMMISSION = BARBERS.reduce((sum, s) => sum + s.commission, 0);

/** Matches the mockup's T10 Staff frame: roster strip, team stats, and the performance table. */
export function StaffPage() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Staff</h1>
        <Button>+ Add Staff</Button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-tn-border px-5 py-3.5">
        <div className="flex items-center gap-5">
          {BARBERS.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5">
              <Avatar initials={b.initials} color={b.avatarColor} />
              <div>
                <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{b.name}</p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  {b.role} · {b.rating.toFixed(1)} ★
                </p>
              </div>
            </div>
          ))}
        </div>
        <span className="font-sans text-xs text-tn-muted-5">
          3 of 4 seats used <span className="text-tn-faint-2">· Business Plan · $12/seat/mo</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="Team sales (this month)" value={`$${TEAM_SALES.toLocaleString()}`} />
        <StatCard label="Avg ticket" value={`$${AVG_TICKET.toFixed(2)}`} />
        <StatCard label="Avg utilization" value={`${AVG_UTILIZATION}%`} />
        <StatCard label="Commission payout" value={`$${TOTAL_COMMISSION.toLocaleString()}`} />
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_1fr_1fr_1fr_1.2fr_0.8fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
          <span>STAFF</span>
          <span>BOOKINGS</span>
          <span>HOURS</span>
          <span>UTILIZATION</span>
          <span>SALES</span>
          <span>AVG TICKET</span>
          <span>COMMISSION</span>
          <span>RATING</span>
        </div>
        {BARBERS.map((b, i) => (
          <div
            key={b.id}
            className={`grid grid-cols-[1.6fr_0.8fr_0.8fr_1fr_1fr_1fr_1.2fr_0.8fr] items-center px-[18px] py-3.5 ${
              i < BARBERS.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <span className="flex items-center gap-2.5 font-sans text-[13px] font-semibold text-tn-ink">
              <Avatar initials={b.initials} color={b.avatarColor} size={26} />
              {b.name}
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">{b.bookings}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{b.hours}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">{b.utilization}%</span>
            <span className="font-sans text-[13px] text-tn-muted-2">${b.sales.toFixed(2)}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">${b.avgTicket.toFixed(2)}</span>
            <span className="font-sans text-[13px] text-tn-muted-2">
              ${b.commission.toFixed(2)} <span className="text-tn-faint-2">({b.commissionRate}%)</span>
            </span>
            <span className="font-sans text-[13px] text-tn-muted-2">{b.rating.toFixed(1)} ★</span>
          </div>
        ))}
      </div>

      <p className="m-0 font-sans text-xs text-tn-muted-6">
        Utilization = booked hours ÷ available hours. Avg ticket = sales ÷ bookings. Commission =
        sales × staff rate.
      </p>
    </div>
  );
}

export default StaffPage;
