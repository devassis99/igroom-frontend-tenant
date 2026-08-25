import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { SeatUpgradeModal } from "@/components/settings/SeatUpgradeModal";
import { AddMemberWizard } from "@/components/settings/AddMemberWizard";
import { EditMemberModal } from "@/components/settings/EditMemberModal";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { getStaffPerformance, type StaffPerformanceMember } from "@/lib/staff-api";

// Stable empty-array fallback — see CalendarPage.tsx's identical comment on why a fresh `[]` literal per render would defeat memoization downstream.
const EMPTY_STAFF: StaffPerformanceMember[] = [];

// No account-level subscription/seats endpoint exists yet — same
// limitation LocationsPage's TOTAL_SEATS comment describes.
// Revisit once a real GET for the account's active plan/seat usage
// exists; usedSeats below (active staff count) is real, just the cap
// isn't.
const TOTAL_SEATS = 8;

const AVATAR_COLORS = [
  "var(--color-tn-avatar-peach)",
  "var(--color-tn-avatar-tan)",
  "var(--color-tn-avatar-cream)",
  "var(--color-tn-avatar-brown)",
  "var(--color-tn-avatar-blue)",
];

/** No stored color/photo for a real staff_users row — see Avatar.tsx's comment. Same deterministic id->color hash as StaffManagementPage.tsx so a given member lands on the same color on both pages. */
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ratingLabel(rating: number | null): string {
  return rating === null ? "—" : `${rating.toFixed(1)} ★`;
}

/**
 * Matches the mockup's T10 Staff frame: roster strip, team stats, and the
 * performance table — now backed by real igroom-backend data (see
 * staff-api.ts's getStaffPerformance) instead of sample-data.ts's static
 * STAFF list. Every number here (bookings/hours/sales/avg ticket) comes
 * from this calendar month's real bookings; utilization additionally
 * needs a saved weekly schedule (Settings > Staff or the onboarding
 * step) and commission additionally needs a commission rate an owner
 * sets via the ✎ edit affordance below (see EditMemberModal.tsx) — both
 * show "—" rather than a misleading 0 until that input exists.
 *
 * "+ Add Staff" reuses the exact same seat-check → wizard flow as
 * Settings > Staff Management (SeatUpgradeModal → AddMemberWizard), so
 * a member added from either page shows up identically on both — they
 * share the same ["staff"]/["staff-performance"] query cache.
 */
export function StaffPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { has: hasPermission } = usePermissions();
  const canManageStaff = hasPermission("staff.manage");

  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffPerformanceMember | null>(null);

  const performanceQuery = useQuery({
    queryKey: ["staff-performance"],
    queryFn: () => getStaffPerformance(accessToken ?? ""),
    enabled: !!accessToken,
  });
  // getStaffPerformance (staff.service.ts, backend) already excludes
  // still-invited rows (no passwordHash/googleSub, never logged in) at
  // the query level — this page is that endpoint's only caller, and an
  // invited row has nothing to report: 0 bookings, 0 hours, "—"
  // everywhere. So `staff` here (and the seat-usage count below, which
  // reads its length) is already "active, claimed team only". Invited
  // members still show up in Settings > Staff Management, with their own
  // "Invited" badge — that's the page for managing the roster itself,
  // not reporting on it.
  const staff = performanceQuery.data?.staff ?? EMPTY_STAFF;
  const team = performanceQuery.data?.team;

  function handleNewMember() {
    setSeatModalOpen(true);
  }

  function handleUpgrade() {
    setSeatModalOpen(false);
    setWizardOpen(true);
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Staff</h1>
        {canManageStaff && <Button onClick={handleNewMember}>+ Add Staff</Button>}
      </div>

      {performanceQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load your team right now (
          {performanceQuery.error instanceof Error
            ? performanceQuery.error.message
            : "unknown error"}
          ) — refresh to try again.
        </p>
      )}
      {performanceQuery.isPending && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">Loading your team…</p>
      )}

      {!performanceQuery.isPending && staff.length === 0 && !performanceQuery.isError && (
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          No active staff yet — add your first one.
        </p>
      )}

      {staff.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-tn-border px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-5">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <Avatar initials={initialsFor(s.name)} color={avatarColorFor(s.id)} />
                <div>
                  <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">{s.name}</p>
                  <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                    {s.roleName || "—"} · {ratingLabel(s.rating)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <span className="font-sans text-xs text-tn-muted-5">
            {staff.length} of {TOTAL_SEATS} seats used{" "}
            <span className="text-tn-faint-2">· Business Plan · $12/seat/mo</span>
          </span>
        </div>
      )}

      {team && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatCard label="Team sales (this month)" value={dollars(team.teamSalesCents)} />
          <StatCard
            label="Avg ticket"
            value={team.avgTicketCents === null ? "—" : dollars(team.avgTicketCents)}
          />
          <StatCard
            label="Avg utilization"
            value={team.avgUtilizationPct === null ? "—" : `${team.avgUtilizationPct}%`}
          />
          <StatCard label="Commission payout" value={dollars(team.commissionPayoutCents)} />
        </div>
      )}

      {staff.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_1fr_1fr_1fr_1.2fr_0.8fr_auto] bg-tn-table-head px-[18px] py-3 font-sans text-xs font-semibold text-tn-muted-5">
            <span>STAFF</span>
            <span>BOOKINGS</span>
            <span>HOURS</span>
            <span>UTILIZATION</span>
            <span>SALES</span>
            <span>AVG TICKET</span>
            <span>COMMISSION</span>
            <span>RATING</span>
            <span />
          </div>
          {staff.map((s, i) => (
            <div
              key={s.id}
              className={`grid grid-cols-[1.6fr_0.8fr_0.8fr_1fr_1fr_1fr_1.2fr_0.8fr_auto] items-center px-[18px] py-3.5 ${
                i < staff.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="flex items-center gap-2.5 font-sans text-[13px] font-semibold text-tn-ink">
                <Avatar initials={initialsFor(s.name)} color={avatarColorFor(s.id)} size={26} />
                {s.name}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">{s.bookingsCount}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">{s.hoursBooked}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {s.utilizationPct === null ? "—" : `${s.utilizationPct}%`}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">{dollars(s.salesCents)}</span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {s.avgTicketCents === null ? "—" : dollars(s.avgTicketCents)}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">
                {s.commissionCents === null ? (
                  "—"
                ) : (
                  <>
                    {dollars(s.commissionCents)}{" "}
                    <span className="text-tn-faint-2">({s.commissionRate}%)</span>
                  </>
                )}
              </span>
              <span className="font-sans text-[13px] text-tn-muted-2">{ratingLabel(s.rating)}</span>
              <button
                type="button"
                title={canManageStaff ? "Edit profile" : "You don't have permission to edit staff"}
                aria-label={`Edit ${s.name}`}
                onClick={() => setEditingMember(s)}
                disabled={!canManageStaff}
                className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✎
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="m-0 font-sans text-xs text-tn-muted-6">
        Utilization = booked hours ÷ available hours (set under Settings &gt; Staff &gt; Schedule).
        Avg ticket = sales ÷ bookings. Commission = sales × staff rate (✎ to set a rate).
      </p>

      <SeatUpgradeModal
        open={seatModalOpen}
        onClose={() => setSeatModalOpen(false)}
        onUpgrade={handleUpgrade}
      />
      <AddMemberWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />
    </div>
  );
}

export default StaffPage;
