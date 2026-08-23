import { useEffect, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/lib/env";
import { createSetupIntent, recordSetupIntent } from "@/lib/payment-methods-api";

/**
 * Module scope on purpose — loadStripe injects Stripe.js into the page
 * and returns a promise the Elements provider expects to be stable.
 * Calling it inside the component would re-inject on every render and
 * tear down the mounted card iframe underneath the user.
 */
const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);

interface AddCardModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The inner half — has to be a separate component because useStripe and
 * useElements only work *inside* an <Elements> provider, which the outer
 * component is the one rendering.
 */
function CardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    // redirect: "if_required" keeps the whole flow in this modal for
    // ordinary cards, while still allowing the redirect a 3-D Secure
    // challenge needs. return_url is only ever used on that branch.
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/settings/billing` },
      redirect: "if_required",
    });

    if (result.error) {
      // Stripe's own messages are already customer-facing ("Your card was
      // declined.", "Your card's expiration year is in the past.") — a
      // generic fallback is only needed for the rare error with none.
      setError(result.error.message ?? "Couldn't save that card — check the details and retry.");
      setSubmitting(false);
      return;
    }

    // The card is attached in Stripe at this point, but the backend's own
    // payment_methods mirror only learns about it from the
    // payment_method.attached webhook — which nothing delivers in local
    // dev. Recording it explicitly makes the row exist immediately, and
    // the call returns the refreshed list so the cache is written from the
    // response rather than costing another round trip.
    //
    // A failure here is NOT swallowed. An earlier version caught it
    // silently, which meant a card that saved in Stripe but never reached
    // our database looked like complete success — the exact failure this
    // whole path exists to prevent. The card really is saved at Stripe, so
    // the message says so and points at the recovery.
    try {
      const refreshed = await recordSetupIntent(accessToken ?? "", result.setupIntent.id);
      queryClient.setQueryData(["payment-methods"], refreshed);
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setError(
        `Your card was saved with Stripe, but igroom couldn't record it: ${
          err instanceof Error ? err.message : "unknown error"
        }. Reload this page — it reconciles automatically.`,
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="m-0 font-sans text-sm text-tn-danger">{error}</p>}
      <div className="flex gap-2.5 pt-1">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onDone}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={!stripe || submitting}>
          {submitting ? "Saving…" : "Save card"}
        </Button>
      </div>
    </form>
  );
}

/**
 * T12g Billing & Plan's "Add card". Creating the SetupIntent is deferred
 * until the modal actually opens — each one is a real Stripe object, so
 * minting them on page load would leave an abandoned intent behind for
 * every visit to the billing page.
 */
export function AddCardModal({ open, onClose }: AddCardModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: () => createSetupIntent(accessToken ?? ""),
    onSuccess: (data) => setClientSecret(data.clientSecret),
  });

  const { mutate: startSetup, reset: resetSetup } = setupMutation;

  useEffect(() => {
    if (!open) {
      // Drop the secret on close so reopening mints a fresh intent — a
      // stale one may already be consumed or expired.
      setClientSecret(null);
      resetSetup();
      return;
    }
    startSetup();
  }, [open, startSetup, resetSetup]);

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div className="flex flex-col gap-4 p-6">
        <h2 className="m-0 font-sans text-lg font-semibold text-tn-ink">Add card</h2>

        {setupMutation.isPending && (
          <p className="m-0 font-sans text-sm text-tn-muted-5">Preparing secure card form…</p>
        )}

        {setupMutation.isError && (
          <>
            <p className="m-0 font-sans text-sm text-tn-danger">
              {setupMutation.error instanceof Error
                ? setupMutation.error.message
                : "Couldn't start the card form — try again."}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        )}

        {clientSecret && (
          <>
            <p className="m-0 font-sans text-xs text-tn-muted-5">
              Card details go straight to Stripe — they never touch igroom&rsquo;s servers.
            </p>
            {/*
              Keyed by the secret so a fresh intent remounts Elements
              outright. The provider reads clientSecret once at mount and
              ignores later changes to it, which would otherwise leave the
              form silently bound to a consumed intent.
            */}
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "stripe" } }}
            >
              <CardForm onDone={onClose} />
            </Elements>
          </>
        )}
      </div>
    </Modal>
  );
}

export default AddCardModal;
