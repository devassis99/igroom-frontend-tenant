import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import { staffAvatarColorStrong } from "@/lib/staff-avatar-color";
import {
  formatCents,
  getTipRule,
  parseCents,
  posKeys,
  setTicketTip,
  type PosTicket,
  type PosTipRole,
} from "@/lib/pos-api";

/**
 * One tip, several hands.
 *
 * The split is applied and *stored* the moment the tip is set, not
 * worked out in a report at the end of the month. That is the whole
 * point: a report changes when the rule changes, and a barber told
 * $9.10 on Friday will not accept $8.40 on Sunday because the owner
 * edited a percentage in between.
 *
 * The percentages come from the shop's rule; the arithmetic is the
 * backend's (largest-remainder, so the shares always sum to exactly the
 * tip). This screen never divides money itself — it shows what the
 * register decided, which is also what each person will see in their own
 * app.
 */

const PRESETS = [18, 20, 25];

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}

const ROLE_LABEL: Record<PosTipRole, string> = {
  chair: "Cut the hair",
  assist: "Wash & finish",
  desk: "Shared nightly",
};

interface TipSplitProps {
  ticket: PosTicket;
  locationId: string;
  onApplied: (ticket: PosTicket) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TipSplit({ ticket, locationId, onApplied, onBack, onContinue }: TipSplitProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [custom, setCustom] = useState("");

  const ruleQuery = useQuery({
    queryKey: posKeys.tipRule(locationId),
    queryFn: () => getTipRule(accessToken ?? "", locationId),
    enabled: Boolean(accessToken && locationId),
  });
  const rule = ruleQuery.data;

  /**
   * A percentage of the *service*, not of the total. Tipping on top of
   * a deposit the client already paid is arithmetic nobody agrees with,
   * and tipping on tax is worse.
   */
  const tipBase = ticket.subtotalCents;

  const apply = useMutation({
    mutationFn: (tipCents: number) => setTicketTip(accessToken ?? "", ticket.id, { tipCents }),
    onSuccess: onApplied,
  });

  const activePercent = useMemo(() => {
    if (!ticket.tipCents || !tipBase) return null;
    const percent = Math.round((ticket.tipCents / tipBase) * 100);
    return PRESETS.includes(percent) ? percent : null;
  }, [ticket.tipCents, tipBase]);

  const notice = errorMessage(apply.error);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((percent) => {
          const cents = Math.round((tipBase * percent) / 100);
          const isActive = activePercent === percent;
          return (
            <button
              key={percent}
              type="button"
              onClick={() => apply.mutate(cents)}
              disabled={apply.isPending}
              className={`cursor-pointer rounded-[9px] px-3.5 py-2.5 font-sans text-[12px] font-semibold ${
                isActive
                  ? "border-none bg-tn-dark text-tn-on-dark"
                  : "border border-tn-input-border bg-transparent text-tn-muted-3 hover:bg-tn-page"
              }`}
            >
              {percent}%{isActive ? ` · ${formatCents(cents)}` : ""}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => apply.mutate(0)}
          disabled={apply.isPending}
          className="cursor-pointer rounded-[9px] border border-tn-input-border bg-transparent px-3.5 py-2.5 font-sans text-[12px] font-semibold text-tn-muted-3 hover:bg-tn-page"
        >
          No tip
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Custom amount"
          inputMode="decimal"
          aria-label="Custom tip amount"
          className="flex-1 rounded-lg border border-tn-input-border bg-transparent px-3 py-2 font-sans text-[12px] text-tn-ink outline-none placeholder:text-tn-placeholder"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            apply.mutate(parseCents(custom));
            setCustom("");
          }}
          disabled={apply.isPending || parseCents(custom) <= 0}
        >
          Apply
        </Button>
      </div>

      {notice && (
        <p className="m-0 rounded-lg border border-tn-danger bg-tn-danger-bg px-3 py-2 font-sans text-[12px] text-tn-danger">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-tn-border px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 font-sans text-[12px] font-semibold text-tn-ink">
            {rule ? rule.name : "Loading the shop rule…"}
          </p>
          {rule?.isInherited && (
            <span className="font-sans text-[10px] text-tn-muted-5">shop-wide rule</span>
          )}
        </div>

        {ticket.tipShares.length === 0 ? (
          <p className="m-0 font-sans text-[12px] text-tn-muted-3">
            {ticket.tipCents === 0 ? "No tip on this ticket." : "Working out the split…"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ticket.tipShares.map((share) => {
              const percent = ticket.tipCents
                ? Math.round((share.amountCents / ticket.tipCents) * 100)
                : 0;
              return (
                <div key={share.id} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-8 w-8 shrink-0 rounded-full"
                    style={{
                      background: share.staffUserId
                        ? staffAvatarColorStrong(share.staffUserId)
                        : "var(--color-tn-muted-6)",
                    }}
                  />
                  <div className="w-[110px] shrink-0">
                    <p className="m-0 font-sans text-[12px] font-semibold text-tn-ink">
                      {share.staffName ?? "Front desk pool"}
                    </p>
                    <p className="m-0 font-sans text-[10px] text-tn-muted-3">
                      {ROLE_LABEL[share.role]}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="h-2 flex-1 overflow-hidden rounded-full bg-tn-border-soft"
                  >
                    <span
                      className="block h-full rounded-full bg-tn-gold"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="w-[62px] shrink-0 text-right font-sans text-[12px] font-semibold text-tn-ink">
                    {formatCents(share.amountCents)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="m-0 rounded-lg bg-tn-gold-bg-soft px-3 py-2.5 font-sans text-[11px] leading-relaxed text-tn-muted-3">
        Each person sees their own share the moment the sale closes, and it is frozen there — a
        later change to the shop's split does not rewrite what they were told tonight.
      </p>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={onContinue}>
          Take payment →
        </Button>
      </div>
    </div>
  );
}
