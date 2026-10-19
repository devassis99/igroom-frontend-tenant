import { useAuthStore } from "@/auth/auth-store";
import { useOnboardingStore } from "@/auth/onboarding-store";

export type AfterPaymentGate =
  | { state: "loading" }
  | { state: "redirect"; to: string }
  | { state: "ready"; accessToken: string };

/**
 * For the two signup steps that come after payment — Business details
 * and Availability. They save straight to the API, so they need the
 * session ReceiptPage starts when it creates the account.
 *
 * Without one, the visitor hasn't got that far: someone who has paid but
 * whose account isn't created yet goes back to ReceiptPage to finish
 * that, and anyone else to the start of signup (their details are kept —
 * they'll be on the account step, then payment). That second case also
 * covers a visitor who reached Business details before the reorder, when
 * it came before payment.
 */
export function useAfterPaymentGate(): AfterPaymentGate {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const paid = useOnboardingStore((s) => s.stripeCheckoutSessionId !== null);
  const accountCreated = useOnboardingStore((s) => s.accountCreated);

  if (status === "unknown") return { state: "loading" };
  if (status === "anonymous" || !accessToken) {
    return { state: "redirect", to: paid && !accountCreated ? "/signup/receipt" : "/signup" };
  }
  return { state: "ready", accessToken };
}
