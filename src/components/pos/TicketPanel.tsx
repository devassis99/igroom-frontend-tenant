import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { TipSplit } from "@/components/pos/TipSplit";
import { useAuthStore } from "@/auth/auth-store";
import { ApiError } from "@/lib/http";
import {
  addTender,
  closeTicket,
  formatCents,
  getTicket,
  parseCents,
  posKeys,
  removeTender,
  settleTender,
  voidTicket,
  type PosTender,
  type PosTicket,
} from "@/lib/pos-api";
import { t } from "@/i18n";

/**
 * The right-hand column of the register: one ticket, from pre-filled to
 * paid.
 *
 * The panel deliberately shows the deposit as its own *credit line*
 * rather than quietly reducing the price. "Haircut $45, paid online
 * −$15, balance $30" is a sentence the client can check; "$30" on its
 * own is one they have to take on trust, and it is the line people
 * query at the desk.
 */

type Step = "ticket" | "tip" | "pay";

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return t("Something went wrong. Try again.");
}

const TENDER_LABEL: Record<PosTender["method"], string> = {
  cash: t("Cash"),
  card: t("Card"),
  payment_link: t("Payment link"),
  deposit: t("Paid online"),
  other: t("Other"),
};

interface TicketPanelProps {
  ticketId: string | null;
  locationId: string;
  onClosed: () => void | Promise<void>;
  onDismiss: () => void;
}

export function TicketPanel({ ticketId, locationId, onClosed, onDismiss }: TicketPanelProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  /**
   * Every ticket starts at its first step with empty inputs. That reset
   * comes from RegisterPage keying this component on the ticket id
   * rather than from an effect here: an effect would set state during
   * the render that first sees the new ticket, costing a second pass and
   * leaving a frame where the panel shows the previous ticket's step.
   * Remounting is what "this is a different thing now" actually means.
   */
  const [step, setStep] = useState<Step>("ticket");
  const [cashInput, setCashInput] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  const ticketQuery = useQuery({
    queryKey: posKeys.ticket(ticketId ?? ""),
    queryFn: () => getTicket(accessToken ?? "", ticketId!),
    enabled: Boolean(accessToken && ticketId),
  });
  const ticket = ticketQuery.data;

  const applyTicket = (next: PosTicket) => queryClient.setQueryData(posKeys.ticket(next.id), next);

  const tender = useMutation({
    mutationFn: (input: {
      method: "cash" | "card" | "payment_link";
      amountCents: number;
      cardLast4?: string;
    }) => addTender(accessToken ?? "", ticket!.id, input),
    onSuccess: applyTicket,
  });
  const settle = useMutation({
    mutationFn: (tenderId: string) => settleTender(accessToken ?? "", ticket!.id, tenderId),
    onSuccess: applyTicket,
  });
  const dropTender = useMutation({
    mutationFn: (tenderId: string) => removeTender(accessToken ?? "", ticket!.id, tenderId),
    onSuccess: applyTicket,
  });
  const close = useMutation({
    mutationFn: () => closeTicket(accessToken ?? "", ticket!.id),
    onSuccess: async (next) => {
      applyTicket(next);
      await onClosed();
    },
  });
  const discard = useMutation({
    mutationFn: () => voidTicket(accessToken ?? "", ticket!.id),
    onSuccess: async (next) => {
      applyTicket(next);
      await onClosed();
      onDismiss();
    },
  });

  if (!ticketId) {
    return (
      <aside
        data-tour="register-ticket"
        className="rounded-2xl border border-dashed border-tn-border bg-tn-surface px-6 py-12 text-center lg:sticky lg:top-6"
      >
        <p className="m-0 font-sans text-sm font-semibold text-tn-ink">{t("No ticket open")}</p>
        <p className="m-0 mt-1.5 font-sans text-[14px] leading-relaxed text-tn-muted-3">
          {t(
            "Pick an appointment and the ticket arrives with the client, the barber, the service and anything already paid online already on it.",
          )}
        </p>
      </aside>
    );
  }

  if (!ticket) {
    return (
      <aside
        data-tour="register-ticket"
        className="rounded-2xl border border-tn-border bg-tn-surface px-6 py-12 text-center lg:sticky lg:top-6"
      >
        <p className="m-0 font-sans text-[14px] text-tn-muted-3">{t("Opening ticket…")}</p>
      </aside>
    );
  }

  const notice =
    errorMessage(tender.error) ??
    errorMessage(close.error) ??
    errorMessage(settle.error) ??
    errorMessage(dropTender.error);

  const settledCents = ticket.tenders
    .filter((t) => t.status === "settled")
    .reduce((sum, t) => sum + t.amountCents, 0);
  const owedCents = ticket.totalCents + ticket.depositAppliedCents;
  const leftCents = Math.max(0, owedCents - settledCents);
  const pendingLink = ticket.tenders.find(
    (t) => t.method === "payment_link" && t.status === "pending",
  );

  return (
    <aside
      data-tour="register-ticket"
      className="flex flex-col gap-4 rounded-2xl border border-tn-border bg-tn-surface p-5 lg:sticky lg:top-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">
            {ticket.customerName ?? t("Counter sale")}
          </p>
          <p className="m-0 font-sans text-[12px] text-tn-muted-3">
            {t("Ticket #{{ticketNumber}}{{value}}", {
              ticketNumber: ticket.ticketNumber,
              value: ticket.bookingId ? t(" · from the booking") : "",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="cursor-pointer border-none bg-transparent font-sans text-[12px] text-tn-muted-5 hover:underline"
        >
          {t("Close panel")}
        </button>
      </div>

      {notice && (
        <p className="m-0 rounded-lg border border-tn-danger bg-tn-danger-bg px-3 py-2 font-sans text-[13px] text-tn-danger">
          {notice}
        </p>
      )}

      {/* --- lines --- */}
      <div className="flex flex-col gap-2.5">
        {ticket.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">{item.name}</p>
              <p className="m-0 font-sans text-[12px] text-tn-muted-3">
                {item.staffName
                  ? t("with {{staffName}}", { staffName: item.staffName })
                  : t("unassigned")}
                {ticket.bookingId ? t(" · auto-added") : ""}
              </p>
            </div>
            <span className="font-sans text-[14px] font-semibold text-tn-ink">
              {formatCents(item.totalCents)}
            </span>
          </div>
        ))}

        {ticket.depositAppliedCents > 0 && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 font-sans text-[14px] font-semibold text-tn-ink">
                {t("Paid online")}
              </p>
              <p className="m-0 font-sans text-[12px] text-tn-muted-3">{t("Taken at booking")}</p>
            </div>
            <span className="font-sans text-[14px] font-semibold text-tn-success">
              −{formatCents(ticket.depositAppliedCents)}
            </span>
          </div>
        )}
      </div>

      <div className="h-px bg-tn-border-soft" />

      <div className="flex flex-col gap-1.5">
        <Row
          label={t("Balance due")}
          value={formatCents(ticket.subtotalCents - ticket.depositAppliedCents)}
        />
        {ticket.taxCents > 0 && <Row label={t("Tax")} value={formatCents(ticket.taxCents)} />}
        <Row
          label={ticket.tipCents > 0 ? t("Tip") : t("Tip — not added yet")}
          value={formatCents(ticket.tipCents)}
        />
      </div>

      <div className="h-px bg-tn-border-soft" />

      <div className="flex items-baseline justify-between">
        <span className="font-sans text-sm font-semibold text-tn-ink">{t("Total")}</span>
        <span className="font-sans text-[24px] font-semibold text-tn-ink">
          {formatCents(ticket.totalCents)}
        </span>
      </div>

      {ticket.status === "paid" ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 rounded-lg bg-tn-success-bg px-3 py-2.5 font-sans text-[13px] font-semibold text-tn-success">
            {t("Paid · ticket #{{ticketNumber}} closed", { ticketNumber: ticket.ticketNumber })}
          </p>
          {ticket.tipShares.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="m-0 font-sans text-[12px] font-semibold tracking-[0.1em] text-tn-muted-5">
                {t("TIP WENT TO")}
              </p>
              {ticket.tipShares.map((share) => (
                <div key={share.id} className="flex justify-between">
                  <span className="font-sans text-[13px] text-tn-muted-3">
                    {share.staffName ?? t("Front desk pool")}
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-tn-ink">
                    {formatCents(share.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={onDismiss}>
            {t("Next customer")}
          </Button>
        </div>
      ) : step === "ticket" ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => setStep("tip")}>{t("Add tip →")}</Button>
          <Button variant="ghost" onClick={() => setStep("pay")}>
            {t("Skip the tip and take payment")}
          </Button>
          <button
            type="button"
            onClick={() => discard.mutate()}
            disabled={discard.isPending}
            className="cursor-pointer border-none bg-transparent font-sans text-[12px] text-tn-muted-5 hover:underline"
          >
            {t("Void this ticket")}
          </button>
        </div>
      ) : step === "tip" ? (
        <TipSplit
          ticket={ticket}
          locationId={locationId}
          onApplied={applyTicket}
          onBack={() => setStep("ticket")}
          onContinue={() => setStep("pay")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="font-sans text-[13px] text-tn-muted-3">{t("Left to collect")}</span>
            <span className="font-sans text-[16px] font-semibold text-tn-ink">
              {formatCents(leftCents)}
            </span>
          </div>

          {ticket.tenders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {ticket.tenders.map((tender) => (
                <div key={tender.id} className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[13px] text-tn-muted-3">
                    {TENDER_LABEL[tender.method]}
                    {tender.cardLast4 ? ` ····${tender.cardLast4}` : ""}
                    {tender.status === "pending" ? t(" · awaiting payment") : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-sans text-[13px] font-semibold text-tn-ink">
                      {formatCents(tender.amountCents)}
                    </span>
                    {tender.method !== "deposit" && (
                      <button
                        type="button"
                        onClick={() => dropTender.mutate(tender.id)}
                        aria-label={t("Remove {{value}} tender", {
                          value: TENDER_LABEL[tender.method],
                        })}
                        className="cursor-pointer border-none bg-transparent font-sans text-[12px] text-tn-muted-5 hover:underline"
                      >
                        {t("remove")}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pendingLink && (
            <Button
              variant="secondary"
              onClick={() => settle.mutate(pendingLink.id)}
              disabled={settle.isPending}
            >
              {t("Mark the payment link as paid")}
            </Button>
          )}

          {leftCents > 0 && (
            <>
              <Button
                onClick={() => tender.mutate({ method: "cash", amountCents: leftCents })}
                disabled={tender.isPending}
              >
                {t("Cash · {{leftCents}}", { leftCents: formatCents(leftCents) })}
              </Button>

              <div className="flex items-center gap-2">
                <input
                  value={cardLast4}
                  onChange={(event) =>
                    setCardLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder={t("last 4")}
                  inputMode="numeric"
                  aria-label={t("Card last four digits")}
                  className="w-[74px] rounded-lg border border-tn-input-border bg-transparent px-2.5 py-2 font-sans text-[13px] text-tn-ink outline-none placeholder:text-tn-placeholder"
                />
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() =>
                    tender.mutate({
                      method: "card",
                      amountCents: leftCents,
                      ...(cardLast4.length === 4 ? { cardLast4 } : {}),
                    })
                  }
                  disabled={tender.isPending}
                >
                  {t("Card taken on the machine")}
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={() => tender.mutate({ method: "payment_link", amountCents: leftCents })}
                disabled={tender.isPending}
              >
                {t("Send a payment link")}
              </Button>

              <div className="flex items-center gap-2">
                <input
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  placeholder={t("Part payment")}
                  inputMode="decimal"
                  aria-label={t("Part payment amount")}
                  className="flex-1 rounded-lg border border-tn-input-border bg-transparent px-3 py-2 font-sans text-[13px] text-tn-ink outline-none placeholder:text-tn-placeholder"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const amountCents = parseCents(cashInput);
                    if (amountCents > 0) tender.mutate({ method: "cash", amountCents });
                    setCashInput("");
                  }}
                  disabled={tender.isPending || parseCents(cashInput) <= 0}
                >
                  {t("Add cash")}
                </Button>
              </div>
            </>
          )}

          <Button onClick={() => close.mutate()} disabled={close.isPending || leftCents > 0}>
            {leftCents > 0
              ? t("{{leftCents}} still to collect", { leftCents: formatCents(leftCents) })
              : t("Close the sale")}
          </Button>
          <Button variant="ghost" onClick={() => setStep("tip")}>
            {t("← Back to the tip")}
          </Button>

          {/*
            A browser cannot take a card tap — EMV needs certified
            hardware or a native Tap-to-Pay SDK. Saying so here is better
            than a "Tap, insert or swipe" button that does nothing, which
            is the moment a shop stops believing the rest of the screen.
          */}
          <p className="m-0 font-sans text-[12px] leading-relaxed text-tn-muted-5">
            {t(
              "Card taps happen on your own machine or the client's phone — this records what was taken. A reader integration is a separate piece of work.",
            )}
          </p>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-sans text-[14px] text-tn-muted-3">{label}</span>
      <span className="font-sans text-[14px] font-medium text-tn-ink">{value}</span>
    </div>
  );
}
