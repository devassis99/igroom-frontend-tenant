import { Link } from "react-router";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { LOCATIONS, TODAY_SCHEDULE, type Appointment } from "@/lib/sample-data";
import { t } from "@/i18n";

const STATUS_TONE: Record<Appointment["status"], "success" | "neutral"> = {
  Confirmed: "success",
  "In chair": "success",
  Waiting: "neutral",
};

/**
 * Reporting/overview page — split off from the mockup's single T6 Owner
 * Dashboard frame (see HomePage.tsx's comment): today's stat tiles,
 * today's schedule, and the by-location breakdown, none of which are
 * onboarding content, now live on their own page instead of sharing one
 * with the "Getting Started" checklist.
 */
export function AnalyticsPage() {
  return (
    // White components on the cream page — see .tn-white-components (index.css).
    <div className="tn-white-components flex flex-col gap-7">
      <h1 className="m-0 font-sans text-[24px] font-semibold text-tn-ink">{t("Analytics")}</h1>

      <div data-tour="analytics-stats" className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label={t("Today's bookings")} value="14" />
        <StatCard label={t("In waitlist now")} value="3" />
        <StatCard label={t("Revenue today")} value="$612" />
        <StatCard label={t("Rating")} value="4.9" />
      </div>

      <div data-tour="analytics-schedule" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="m-0 font-sans text-base font-semibold text-tn-ink">
            {t("Today’s schedule")}
          </p>
          <Link to="/calendar" className="font-sans text-[14px] font-medium text-tn-gold">
            {t("View calendar")}
          </Link>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface">
          {TODAY_SCHEDULE.map((apt, i) => (
            <div
              key={apt.id}
              className={`flex items-center gap-4 px-[18px] py-3.5 ${
                i < TODAY_SCHEDULE.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="w-[70px] flex-none font-sans text-[14px] font-semibold text-tn-ink-soft">
                {apt.time}
              </span>
              <Avatar initials="" color={apt.avatarColor} />
              <div className="flex-1">
                <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">
                  {apt.customer} · {apt.service}
                </p>
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                  {t("with {{barber}}", { barber: apt.barber })}
                </p>
              </div>
              <StatusPill tone={STATUS_TONE[apt.status]}>{apt.status}</StatusPill>
            </div>
          ))}
        </div>
      </div>

      <div data-tour="analytics-locations" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="m-0 font-sans text-base font-semibold text-tn-ink">{t("By location")}</p>
          <Link to="/locations" className="font-sans text-[14px] font-medium text-tn-gold">
            {t("View locations")}
          </Link>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border bg-tn-surface">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
            <span>{t("Location")}</span>
            <span>{t("Bookings")}</span>
            <span>{t("Waitlist")}</span>
            <span>{t("Revenue")}</span>
          </div>
          {LOCATIONS.map((loc, i) => (
            <div
              key={loc.id}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-[18px] py-3.5 ${
                i < LOCATIONS.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="font-sans text-[14px] font-semibold text-tn-ink">{loc.name}</span>
              <span className="font-sans text-[14px] text-tn-muted-2">{loc.bookingsToday}</span>
              <span className="font-sans text-[14px] text-tn-muted-2">
                {loc.id === "downtown" ? 3 : 1}
              </span>
              <span className="font-sans text-[14px] text-tn-muted-2">${loc.revenueToday}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
