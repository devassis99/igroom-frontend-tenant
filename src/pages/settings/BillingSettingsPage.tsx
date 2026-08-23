import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddCardModal } from "@/components/settings/AddCardModal";
import { useAuthStore } from "@/auth/auth-store";
import { BILLING_CYCLE_LABEL, type BillingCycle } from "@/lib/sample-data";
import {
  formatCardBrand,
  formatCardExpiry,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods-api";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "biannual", "annual"];

const INVOICES = [
  { date: "Aug 8, 2026", amount: 48.0 },
  { date: "Jul 8, 2026", amount: 48.0 },
  { date: "Jun 8, 2026", amount: 36.0 },
];

/** Matches the mockup's T12g Billing & Plan page. */
export function BillingSettingsPage() {
  const owner = useAuthStore((s) => s.owner);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>(owner?.billingCycle ?? "monthly");
  const [addingCard, setAddingCard] = useState(false);
  const [removingCard, setRemovingCard] = useState<PaymentMethod | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => listPaymentMethods(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const paymentMethods = paymentMethodsQuery.data?.paymentMethods ?? [];

  // Both mutations return the refreshed list, so the cache is written
  // straight from the response instead of triggering another GET.
  const defaultMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      setDefaultPaymentMethod(accessToken ?? "", paymentMethodId),
    onSuccess: (data) => {
      queryClient.setQueryData(["payment-methods"], data);
      setCardError(null);
    },
    onError: (err) =>
      setCardError(err instanceof Error ? err.message : "Couldn't update the default card."),
  });

  const removeMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      removePaymentMethod(accessToken ?? "", paymentMethodId),
    onSuccess: (data) => {
      queryClient.setQueryData(["payment-methods"], data);
      setRemovingCard(null);
      setCardError(null);
    },
    onError: (err) => {
      // The backend refuses to detach the last card while a subscription
      // is live — that message is the useful one, so surface it on the
      // page rather than swallowing it when the dialog closes.
      setRemovingCard(null);
      setCardError(err instanceof Error ? err.message : "Couldn't remove that card.");
    },
  });

  const busy = defaultMutation.isPending || removeMutation.isPending;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Billing &amp; Plan</h1>

      <section className="flex flex-col gap-4 rounded-2xl border border-tn-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-sans text-xs font-semibold tracking-[0.02em] text-tn-muted-5">
              CURRENT PLAN
            </span>
            <p className="m-0 mt-1 font-serif text-xl font-semibold text-tn-ink">
              {owner?.planName ?? "Business"}
            </p>
            <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
              $12/seat/mo · next charge <strong className="text-tn-ink">$48</strong> on Sep 8, 2026
            </p>
          </div>
          <Button variant="secondary" size="sm">
            Change plan
          </Button>
        </div>

        <SegmentedControl
          value={cycle}
          onChange={setCycle}
          options={CYCLES.map((c) => ({
            value: c,
            label: c === "annual" ? `${BILLING_CYCLE_LABEL[c]} -20%` : BILLING_CYCLE_LABEL[c],
          }))}
        />

        <div className="flex items-center justify-between rounded-xl bg-tn-page px-4 py-3">
          <span className="font-sans text-sm font-semibold text-tn-ink">
            4 <span className="font-normal text-tn-muted-4">of 5 seats</span>
          </span>
          <span className="font-sans text-xs font-medium text-tn-gold">1 seat left</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Payment method</p>
          <Button variant="ghost" size="sm" onClick={() => setAddingCard(true)}>
            Add card
          </Button>
        </div>

        {paymentMethodsQuery.isPending && (
          <p className="m-0 font-sans text-sm text-tn-muted-5">Loading saved cards…</p>
        )}

        {paymentMethodsQuery.isError && (
          <p className="m-0 font-sans text-sm text-tn-danger">
            {paymentMethodsQuery.error instanceof Error
              ? paymentMethodsQuery.error.message
              : "Couldn't load your saved cards."}
          </p>
        )}

        {paymentMethodsQuery.isSuccess && paymentMethods.length === 0 && (
          <div className="rounded-2xl border border-dashed border-tn-border p-6 text-center">
            <p className="m-0 font-sans text-sm text-tn-muted-4">No card on file.</p>
            <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
              Add one to keep your subscription from lapsing at the next renewal.
            </p>
          </div>
        )}

        {paymentMethods.map((card) => (
          <div
            key={card.id}
            className="flex items-center gap-4 rounded-2xl border border-tn-border p-4"
          >
            <span className="rounded-md bg-tn-blue-bg px-2 py-1 font-sans text-[11px] font-bold text-tn-blue">
              {formatCardBrand(card.brand)}
            </span>
            <div className="flex-1">
              <p className="m-0 font-sans text-sm font-medium text-tn-ink">•••• {card.last4}</p>
              <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">
                Expires {formatCardExpiry(card.expMonth, card.expYear)}
              </p>
            </div>
            {card.isDefault ? (
              <StatusPill tone="neutral">DEFAULT</StatusPill>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => defaultMutation.mutate(card.id)}
              >
                Make default
              </Button>
            )}
            <button
              type="button"
              title="Remove card"
              aria-label={`Remove card ending ${card.last4}`}
              disabled={busy}
              onClick={() => setRemovingCard(card)}
              className="cursor-pointer border-none bg-transparent p-0 font-sans text-tn-muted-5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {/* Same ⌫ as Staff Management's role delete — see that file's comment on why not 🗑. */}
              ⌫
            </button>
          </div>
        ))}

        {cardError && <p className="m-0 font-sans text-sm text-tn-danger">{cardError}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">Billing history</p>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
          {INVOICES.map((inv, i) => (
            <div
              key={inv.date}
              className={`flex items-center justify-between px-5 py-3.5 ${
                i < INVOICES.length - 1 ? "border-b border-tn-border-soft" : ""
              }`}
            >
              <span className="font-sans text-[13px] text-tn-ink-soft">{inv.date}</span>
              <span className="font-sans text-[13px] font-semibold text-tn-ink">
                ${inv.amount.toFixed(2)}
              </span>
              <StatusPill tone="success">Paid</StatusPill>
              <span className="cursor-pointer font-sans text-tn-muted-5" aria-hidden>
                ↓
              </span>
            </div>
          ))}
        </div>
      </section>

      <AddCardModal open={addingCard} onClose={() => setAddingCard(false)} />

      <ConfirmModal
        open={removingCard !== null}
        onClose={() => setRemovingCard(null)}
        onConfirm={() => removingCard && removeMutation.mutate(removingCard.id)}
        title={`Remove card ending ${removingCard?.last4 ?? ""}?`}
        body={
          paymentMethods.length === 1
            ? "This is the only card on file. Any subscription renewal after this will have nothing to charge until you add another."
            : removingCard?.isDefault
              ? "This is the card your subscription is charged to. Another saved card will be promoted to default in its place."
              : "You can add it again later."
        }
        confirmLabel="Remove"
        confirming={removeMutation.isPending}
      />
    </div>
  );
}

export default BillingSettingsPage;
