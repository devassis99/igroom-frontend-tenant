import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { LocationFilterPopover } from "@/components/ui/LocationFilterPopover";
import { StatCard } from "@/components/ui/StatCard";
import { TipRuleEditor } from "@/components/pos/TipRuleEditor";
import { PermissionNotice, isForbidden } from "@/components/pos/PermissionNotice";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { listLocations } from "@/lib/locations-api";
import {
  closeDay,
  formatCents,
  getDayClose,
  markPayoutPaid,
  parseCents,
  posKeys,
  type DayCloseStaffRow,
  type StaffCompModel,
} from "@/lib/pos-api";

/**
 * Close of day.
 *
 * Owners do this in a spreadsheet on Sunday. The register already knows
 * every ticket, tip share and tender, so the only thing it genuinely
 * cannot know is how much cash is physically in the drawer — which is
 * the one number this screen asks a human for. Everything else is read
 * back, not typed.
 *
 * What it does *not* do is move money. There is no Stripe Connect in the
 * backend, so this produces a payout statement per person at tonight's
 * rates and lets the owner tick them off as they settle. Wiring real
 * transfers is a separate integration, and the row shape here — one per
 * person per day, with the rate copied onto it — is what that would pay
 * against.
 */

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

const COMP_LABEL: Record<StaffCompModel, string> = {
  commission: "commission",
  hourly: "Hourly + tips",
  chair_rent: "Chair rent",
};

function compDescription(row: DayCloseStaffRow): string {
  if (row.compModel === "commission") return `${row.commissionRate ?? 0}% commission`;
  if (row.compModel === "hourly") return COMP_LABEL.hourly;
  return `Chair rent · ${formatCents(row.chairRentCents ?? 0)}/wk`;
}

export function CloseOfDayPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [chosenLocationId, setChosenLocationId] = useState<string | null>(null);
  /**
   * Null means "nobody has typed a count yet", and the field then shows
   * what the register expects — so the common case is "the drawer
   * agrees, press the button" and any other number is one a person
   * deliberately entered.
   *
   * Derived rather than seeded by an effect: an effect that writes state
   * during the render which first sees the day costs a second pass every
   * time, and on a screen that refetches it is the exact shape that
   * turns into a loop the first time somebody adds a dependency.
   */
  const [countedDraft, setCountedDraft] = useState<string | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const locations = useMemo(
    () => (locationsQuery.data?.locations ?? []).filter((l) => l.inScope),
    [locationsQuery.data],
  );
  const defaultLocationId = useMemo(
    () => locations.find((l) => l.isPrimary)?.id ?? locations[0]?.id ?? "",
    [locations],
  );
  const selectedLocationId = chosenLocationId ?? defaultLocationId;

  const closeQuery = useQuery({
    queryKey: posKeys.close(selectedLocationId),
    queryFn: () => getDayClose(accessToken ?? "", selectedLocationId),
    enabled: Boolean(accessToken && selectedLocationId),
  });
  const day = closeQuery.data;

  const applyClose = (next: Parameters<typeof queryClient.setQueryData>[1]) =>
    queryClient.setQueryData(posKeys.close(selectedLocationId), next);

  const finish = useMutation({
    mutationFn: () =>
      closeDay(accessToken ?? "", {
        locationId: selectedLocationId,
        countedCashCents: parseCents(counted),
      }),
    onSuccess: applyClose,
  });
  const settle = useMutation({
    mutationFn: (payoutId: string) => markPayoutPaid(accessToken ?? "", payoutId),
    onSuccess: applyClose,
  });

  const notice = errorMessage(finish.error) ?? errorMessage(closeQuery.error);
  // A closed day's count is a fact, not a suggestion, so it always wins.
  const counted =
    day?.status === "closed"
      ? ((day.countedCashCents ?? 0) / 100).toFixed(2)
      : (countedDraft ?? (day ? (day.expectedCashCents / 100).toFixed(2) : ""));
  const countedCents = parseCents(counted);
  const previewVariance = day ? countedCents - day.expectedCashCents : 0;
  const variance = day?.status === "closed" ? (day.varianceCents ?? 0) : previewVariance;

  if (isForbidden(closeQuery.error)) {
    return (
      <PermissionNotice
        title="Close of day"
        what="Counting the drawer and seeing what each chair took home needs the “Close the day” permission."
      />
    );
  }

  if (locationsQuery.isSuccess && locations.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Close of day</h1>
        <p className="m-0 max-w-[60ch] font-sans text-sm text-tn-muted-3">
          You are not assigned to a branch yet, so there is no day to close.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">Close of day</h1>
          {locations.length > 1 && (
            <LocationFilterPopover
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              value={selectedLocationId}
              onChange={(next) => {
                setChosenLocationId(next);
                // A count typed for one branch's drawer means nothing for
                // another's.
                setCountedDraft(null);
              }}
              label="Choose a branch"
              includeAllOption={false}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRuleOpen(true)}>
            Tip split rule
          </Button>
          <span className="font-sans text-xs text-tn-muted-5">
            {day
              ? new Date(`${day.businessDate}T12:00:00`).toLocaleDateString([], {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })
              : ""}
          </span>
        </div>
      </div>

      {notice && (
        <p className="m-0 rounded-xl border border-tn-danger bg-tn-danger-bg px-4 py-3 font-sans text-[13px] text-tn-danger">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Tickets" value={String(day?.ticketCount ?? 0)} />
        <StatCard label="Taken" value={formatCents(day?.grossSalesCents ?? 0)} />
        <StatCard label="Tips" value={formatCents(day?.tipsCents ?? 0)} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex flex-col gap-3">
          <p className="m-0 font-sans text-xs font-semibold tracking-[0.1em] text-tn-muted-5">
            WHO IS OWED WHAT
          </p>

          {day && day.staff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-tn-border px-5 py-10 text-center">
              <p className="m-0 font-sans text-sm font-semibold text-tn-ink">
                Nothing rung up yet today
              </p>
              <p className="m-0 mt-1 font-sans text-[13px] text-tn-muted-3">
                Close a ticket on the register and it will show up here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-tn-border">
              <div className="flex bg-tn-table-head px-4 py-2.5">
                <span className="flex-[1.4] font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-muted-5">
                  BARBER
                </span>
                <span className="w-[78px] text-right font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-muted-5">
                  SERVICES
                </span>
                <span className="w-[64px] text-right font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-muted-5">
                  TIPS
                </span>
                <span className="w-[118px] text-right font-sans text-[11px] font-semibold tracking-[0.06em] text-tn-muted-5">
                  PAYOUT
                </span>
              </div>
              {day?.staff.map((row) => (
                <div
                  key={row.staffUserId}
                  className="flex items-center border-b border-tn-border-soft px-4 py-3 last:border-b-0"
                >
                  <div className="flex-[1.4]">
                    <p className="m-0 font-sans text-[13px] font-semibold text-tn-ink">
                      {row.name}
                    </p>
                    <p className="m-0 font-sans text-[11px] text-tn-muted-3">
                      {compDescription(row)}
                    </p>
                  </div>
                  <span className="w-[78px] text-right font-sans text-[13px] text-tn-ink-soft">
                    {formatCents(row.serviceCents)}
                  </span>
                  <span className="w-[64px] text-right font-sans text-[13px] text-tn-ink-soft">
                    {formatCents(row.tipsCents)}
                  </span>
                  <span className="flex w-[118px] shrink-0 flex-col items-end">
                    {/*
                      A chair renter's number points the other way: they
                      took the customers' money and owe the shop rent, so
                      this row is an invoice, not a payment. Showing both
                      as "payout" is how a shop ends up paying its renters.
                      The direction is carried by a minus sign and the
                      caption below rather than by a word wedged into the
                      figure, which ran into the tips column.
                    */}
                    <span
                      className={`font-sans text-[13px] font-semibold ${
                        row.payoutCents < 0 ? "text-tn-danger" : "text-tn-ink"
                      }`}
                    >
                      {row.payoutCents < 0
                        ? `\u2212${formatCents(Math.abs(row.payoutCents))}`
                        : formatCents(row.payoutCents)}
                    </span>
                    {row.payoutCents < 0 ? (
                      <span className="font-sans text-[11px] text-tn-danger">owes the shop</span>
                    ) : row.id && row.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => settle.mutate(row.id!)}
                        disabled={settle.isPending}
                        className="cursor-pointer border-none bg-transparent font-sans text-[11px] text-tn-gold hover:underline"
                      >
                        mark settled
                      </button>
                    ) : row.status === "paid" ? (
                      <span className="font-sans text-[11px] text-tn-success">settled</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}

          {day && day.deskPoolCents > 0 && (
            <p className="m-0 rounded-xl bg-tn-gold-bg-soft px-4 py-3 font-sans text-[12px] leading-relaxed text-tn-muted-3">
              {formatCents(day.deskPoolCents)} of tonight&rsquo;s tips is the front desk pool. It is
              shown on its own rather than folded into someone&rsquo;s total, because the register
              knows it was earned and does not yet know whose shift it belongs to.
            </p>
          )}

          <p className="m-0 font-sans text-[12px] leading-relaxed text-tn-muted-5">
            These are payout statements, frozen at tonight&rsquo;s rates — not transfers. Staff see
            the same breakdown for their own work, so nobody has to ask.
          </p>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border border-tn-border bg-tn-surface p-5 lg:sticky lg:top-6">
          <p className="m-0 font-sans text-[11px] font-semibold tracking-[0.1em] text-tn-muted-5">
            DRAWER COUNT
          </p>
          <div className="flex flex-col gap-2.5">
            <Row label="Opening float" value={formatCents(day?.openingFloatCents ?? 0)} />
            <Row label="Cash sales" value={formatCents(day?.cashSalesCents ?? 0)} />
            <Row label="Expected" value={formatCents(day?.expectedCashCents ?? 0)} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] text-tn-muted-5">Counted</span>
            <input
              value={counted}
              onChange={(event) => setCountedDraft(event.target.value)}
              disabled={day?.status === "closed"}
              inputMode="decimal"
              className="rounded-lg border border-tn-input-border bg-tn-surface px-3.5 py-3 font-sans text-[15px] font-semibold text-tn-ink outline-none disabled:opacity-70"
            />
          </label>

          {day && (
            <div
              className={`flex items-center justify-between rounded-lg px-3.5 py-3 ${
                variance === 0
                  ? "bg-tn-success-bg"
                  : variance < 0
                    ? "bg-tn-danger-bg"
                    : "bg-tn-gold-bg-soft"
              }`}
            >
              <span
                className={`font-sans text-[13px] font-medium ${
                  variance === 0
                    ? "text-tn-success"
                    : variance < 0
                      ? "text-tn-danger"
                      : "text-tn-gold"
                }`}
              >
                {variance === 0 ? "Balances" : variance < 0 ? "Short" : "Over"}
              </span>
              <span
                className={`font-sans text-[13px] font-semibold ${
                  variance === 0
                    ? "text-tn-success"
                    : variance < 0
                      ? "text-tn-danger"
                      : "text-tn-gold"
                }`}
              >
                {variance === 0 ? formatCents(0) : formatCents(variance)}
              </span>
            </div>
          )}

          <div className="h-px bg-tn-border-soft" />

          <div className="flex items-baseline justify-between">
            <span className="font-sans text-sm font-semibold text-tn-ink">Total payouts</span>
            <span className="font-sans text-[22px] font-semibold text-tn-ink">
              {formatCents(day?.payoutTotalCents ?? 0)}
            </span>
          </div>

          {day?.status === "closed" ? (
            <p className="m-0 rounded-lg bg-tn-success-bg px-3 py-2.5 font-sans text-[12px] font-semibold text-tn-success">
              Closed
              {day.closedAt
                ? ` at ${new Date(day.closedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          ) : (
            <Button onClick={() => finish.mutate()} disabled={finish.isPending || !day}>
              Count the drawer &amp; close
            </Button>
          )}
        </aside>
      </div>

      <TipRuleEditor
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        locationId={selectedLocationId}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-sans text-[13px] text-tn-muted-3">{label}</span>
      <span className="font-sans text-[13px] font-semibold text-tn-ink">{value}</span>
    </div>
  );
}

export default CloseOfDayPage;
