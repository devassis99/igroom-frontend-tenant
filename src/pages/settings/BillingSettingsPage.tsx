import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddCardModal } from "@/components/settings/AddCardModal";
import { useAuthStore } from "@/auth/auth-store";
import {
  formatBillingDate,
  formatMoney,
  getBillingOverview,
  getInvoicePdfUrl,
  type BillingInvoice,
  type BillingOverview,
} from "@/lib/account-billing-api";
import {
  formatCardBrand,
  formatCardExpiry,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods-api";

const PER_INTERVAL: Record<string, string> = {
  month: "/ month",
  quarter: "/ quarter",
  half_year: "/ 6 months",
  year: "/ year",
};

const INVOICE_STATUS: Record<
  string,
  { label: string; tone: "success" | "danger" | "neutral" | "gold" }
> = {
  paid: { label: "Paid", tone: "success" },
  open: { label: "Due", tone: "gold" },
  uncollectible: { label: "Unpaid", tone: "danger" },
  void: { label: "Void", tone: "neutral" },
};

/** One line under the plan name: what's next for this subscription, in the order that matters most. */
function subscriptionLine(overview: BillingOverview): string | null {
  const sub = overview.subscription;
  if (!sub) return null;
  if (sub.status === "past_due" || overview.accountStatus === "past_due") {
    return "Your last payment failed — update your card below and we'll retry automatically.";
  }
  if (sub.status === "canceled") return "This subscription has ended.";
  if (sub.cancelAtPeriodEnd) {
    return `Cancels on ${formatBillingDate(sub.currentPeriodEnd)} — no further charges.`;
  }
  const next = sub.nextCharge
    ? `next charge ${formatMoney(sub.nextCharge.amount, sub.nextCharge.currency)} on ${formatBillingDate(sub.nextCharge.date)}`
    : null;
  if (sub.trialEndsAt) {
    return `Free trial until ${formatBillingDate(sub.trialEndsAt)}${next ? ` · ${next}` : ""}`;
  }
  return next ? next.charAt(0).toUpperCase() + next.slice(1) : null;
}

/** Matches the mockup's T12g Billing & Plan page. */
export function BillingSettingsPage() {
  const owner = useAuthStore((s) => s.owner);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["billing-overview"],
    queryFn: () => getBillingOverview(accessToken ?? ""),
    enabled: !!accessToken,
  });
  const overview = overviewQuery.data;

  // Asks for a fresh link every click rather than caching one: archived
  // invoices come back as short-lived signed S3 URLs.
  async function downloadInvoice(invoice: BillingInvoice) {
    setDownloadError(null);
    setDownloadingId(invoice.id);
    try {
      const { url } = await getInvoicePdfUrl(accessToken ?? "", invoice.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Couldn't download that invoice.");
    } finally {
      setDownloadingId(null);
    }
  }
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

      <section
        data-tour="billing-plan"
        className="flex flex-col gap-4 rounded-2xl border border-tn-border p-5"
      >
        {overviewQuery.isPending && (
          <p className="m-0 font-sans text-sm text-tn-muted-5">Loading your plan…</p>
        )}
        {overviewQuery.isError && (
          <p className="m-0 font-sans text-sm text-tn-danger">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Couldn't load your plan."}
          </p>
        )}
        {overview && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-sans text-xs font-semibold tracking-[0.02em] text-tn-muted-5">
                  CURRENT PLAN
                </span>
                <p className="m-0 mt-1 font-serif text-xl font-semibold text-tn-ink">
                  {overview.plan?.name ?? owner?.planName ?? "No plan"}
                </p>
                {overview.plan && (
                  <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
                    {formatMoney(overview.plan.unitAmount, overview.plan.currency)}{" "}
                    {PER_INTERVAL[overview.plan.billingInterval] ?? ""}
                  </p>
                )}
                {subscriptionLine(overview) && (
                  <p className="m-0 mt-1 font-sans text-xs text-tn-ink">
                    {subscriptionLine(overview)}
                  </p>
                )}
              </div>
              {(overview.subscription?.status === "past_due" ||
                overview.accountStatus === "past_due") && (
                <StatusPill tone="danger">Payment failed</StatusPill>
              )}
              {overview.subscription?.trialEndsAt && <StatusPill tone="gold">Trial</StatusPill>}
            </div>

            {overview.seats && (
              <div className="flex items-center justify-between rounded-xl bg-tn-page px-4 py-3">
                <span className="font-sans text-sm font-semibold text-tn-ink">
                  {overview.seats.used}{" "}
                  <span className="font-normal text-tn-muted-4">
                    of {overview.seats.limit} {overview.seats.unit}
                  </span>
                </span>
                <span
                  className={`font-sans text-xs font-medium ${
                    overview.seats.used >= overview.seats.limit ? "text-tn-danger" : "text-tn-gold"
                  }`}
                >
                  {overview.seats.used >= overview.seats.limit
                    ? "Limit reached"
                    : `${overview.seats.limit - overview.seats.used} left`}
                </span>
              </div>
            )}

            {overview.stripeError && (
              <p className="m-0 font-sans text-xs text-tn-muted-5">{overview.stripeError}</p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3" data-tour="billing-payment-method">
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

        {overview && overview.invoices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-tn-border p-6 text-center">
            <p className="m-0 font-sans text-sm text-tn-muted-4">No invoices yet.</p>
            {overview.subscription?.trialEndsAt && (
              <p className="m-0 mt-1 font-sans text-xs text-tn-muted-5">
                Your first one is issued when your trial ends on{" "}
                {formatBillingDate(overview.subscription.trialEndsAt)}.
              </p>
            )}
          </div>
        )}

        {overview && overview.invoices.length > 0 && (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
            {overview.invoices.map((invoice, i) => {
              const status = INVOICE_STATUS[invoice.status] ?? {
                label: invoice.status,
                tone: "neutral" as const,
              };
              return (
                <div
                  key={invoice.id}
                  className={`grid grid-cols-[1.2fr_1fr_0.8fr_auto] items-center gap-4 px-5 py-3.5 ${
                    i < overview.invoices.length - 1 ? "border-b border-tn-border-soft" : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-sans text-[13px] text-tn-ink-soft">
                      {formatBillingDate(invoice.issuedAt)}
                    </span>
                    {invoice.number && (
                      <span className="font-sans text-[11px] text-tn-muted-5">
                        {invoice.number}
                      </span>
                    )}
                  </div>
                  <span className="font-sans text-[13px] font-semibold text-tn-ink">
                    {formatMoney(invoice.total, invoice.currency)}
                  </span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <button
                    type="button"
                    onClick={() => void downloadInvoice(invoice)}
                    disabled={downloadingId === invoice.id}
                    aria-label={`Download invoice ${invoice.number ?? formatBillingDate(invoice.issuedAt)}`}
                    title="Download PDF"
                    className="cursor-pointer border-0 bg-transparent font-sans text-tn-muted-5 hover:text-tn-ink disabled:cursor-wait disabled:opacity-50"
                  >
                    {downloadingId === invoice.id ? "…" : "↓"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {downloadError && <p className="m-0 font-sans text-sm text-tn-danger">{downloadError}</p>}
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
