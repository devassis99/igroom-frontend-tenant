import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { signup } from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";

const AFTER_RECEIPT = new Set(["/signup/business", "/signup/availability"]);

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase() || "USD",
  }).format(cents / 100);
}

/**
 * Matches the mockup's T5 receipt frame — where Stripe sends the visitor
 * back once they've paid (success_url — see accounts.service.ts's
 * createCheckoutSession). Two jobs, in order:
 *
 * 1. Create the account, the moment the payment is confirmed. Signup runs
 *    Account → (Plan) → Payment → Receipt → Business details →
 *    Availability, so a shop that has paid must never be left without an
 *    account just because it closed the tab before the last two screens.
 * 2. Show the receipt — payment received, the plan, the invoice — with a
 *    Continue into Business details. It's the first thing after Stripe,
 *    not the last screen of signup: the shop has no name yet here, so the
 *    copy talks about the payment and the account, not the business.
 *    Availability ends signup by handing over to the dashboard.
 *
 * POST /accounts/signup verifies this exact Checkout Session server-side
 * before creating anything. No business name is sent — the backend names
 * the account after its owner and flags it needsBusinessDetails, and the
 * next screen (BusinessDetailsPage) gives it its real name, signed in.
 * A visitor who filled in business details before the reorder still has
 * them in the onboarding store; those are sent, and they skip straight to
 * Availability.
 *
 * Reads Stripe's one-time `?session_id=` the moment it arrives and
 * persists it to the onboarding store (stripeCheckoutSessionId) so a
 * manual URL edit, reload, or resume-via-lastRoute after that doesn't
 * force a second real Stripe Checkout — see onboarding-store.ts's comment
 * on that field. `accountCreated` then stops a reload from trying to
 * create the account twice — a reload just shows the receipt again.
 */
export function ReceiptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("session_id");
  const onboarding = useOnboardingStore();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  // Only a visitor from before the reorder gave business details before
  // paying; they go straight on to Availability.
  const [nextRoute, setNextRoute] = useState("/signup/business");
  const startedRef = useRef(false);

  const plan = onboarding.selectedPlan;
  const effectiveSessionId = urlSessionId ?? onboarding.stripeCheckoutSessionId;

  useEffect(() => {
    if (urlSessionId) {
      onboarding.setStripeCheckoutSessionId(urlSessionId);
      // A real Stripe payment already went through the moment this URL
      // param shows up — from here on, Plan/Checkout are irrelevant to
      // resuming (re-visiting them would mean paying a second time).
      // Recording this as the resume point means a visitor who closes the
      // tab before the account is created comes back straight here (via
      // LandingPage's "Continue where you left off"), not to /signup/plan.
      onboarding.setLastRoute("/signup/receipt");
    }
    // Only re-run when the URL param itself changes — onboarding's
    // setter identity is stable across renders (zustand).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  useEffect(() => {
    if (startedRef.current) return;
    // Already created on an earlier visit (a reload, or an invite link
    // opened again) — the receipt below is all there is to do here.
    if (onboarding.accountCreated) {
      startedRef.current = true;
      return;
    }
    if (!plan || !effectiveSessionId) {
      // Landed here without paying (bookmark, back button, or a checkout
      // session that never actually completed) — send back to pay rather
      // than letting signup() fail with a confusing error.
      navigate("/signup/plan", { replace: true });
      return;
    }
    startedRef.current = true;

    (async () => {
      try {
        // Only a visitor from before the reorder has these already.
        const businessName = onboarding.businessName.trim();
        const tokens = await signup({
          fullName: onboarding.fullName,
          workEmail: onboarding.workEmail,
          password: onboarding.googleIdToken ? undefined : onboarding.password,
          googleIdToken: onboarding.googleIdToken ?? undefined,
          ...(businessName
            ? { businessName, category: onboarding.category, phone: onboarding.phone }
            : {}),
          planKey: plan.key,
          billingCycle: onboarding.billingCycle,
          signupLinkToken: onboarding.signupLinkToken ?? undefined,
          stripeCheckoutSessionId: effectiveSessionId,
        });

        loginWithSession({
          owner: {
            fullName: onboarding.fullName,
            workEmail: onboarding.workEmail,
            businessName: businessName || `${onboarding.fullName}'s shop`,
            category: businessName ? onboarding.category : "",
            address: "",
            phone: businessName ? onboarding.phone : "",
            planKey: plan.key,
            planName: plan.name,
            priceCents: plan.priceCents,
            currency: plan.currency,
            billingCycle: onboarding.billingCycle,
            seats: 4,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
        // Also wipes the password from localStorage — it's done its job.
        // The receipt renders from here on (accountCreated).
        onboarding.setAccountCreated();
        if (businessName) setNextRoute("/signup/availability");
      } catch (err) {
        // igroom-backend's signup() throws a 409 ConflictError both for
        // "email already exists" and "this checkout session was already
        // used" — the latter can legitimately happen on a reload of this
        // page after an earlier successful run, so point at logging in
        // rather than a dead end.
        if (err instanceof ApiError) {
          setError({ message: err.message, status: err.status });
        } else if (err instanceof Error) {
          setError({ message: err.message });
        } else {
          setError({ message: "Something went wrong completing signup. Try again." });
        }
      }
      // onboarding is the whole store (state + stable action refs) —
      // only plan/effectiveSessionId actually gate when this re-runs;
      // startedRef above keeps it to a single real attempt regardless.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [plan, effectiveSessionId, onboarding, loginWithSession, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
        <div className="flex w-[460px] flex-col gap-4 text-center">
          <p className="m-0 font-sans text-sm text-tn-danger">{error.message}</p>
          {error.status === 409 && (
            <Link to="/login" className="font-sans text-sm font-medium text-tn-gold underline">
              Log in instead
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!onboarding.accountCreated || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          Payment received — setting up your account…
        </p>
      </div>
    );
  }

  const firstName = onboarding.fullName.split(" ")[0] || "there";
  const invoiceNumber = effectiveSessionId
    ? `INV-${effectiveSessionId.slice(-8).toUpperCase()}`
    : "—";
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // A reload after the visitor already moved on (Back, or a reopened
  // invite link) continues from the step they got to.
  const continueTo = AFTER_RECEIPT.has(onboarding.lastRoute)
    ? onboarding.lastRoute
    : nextRoute;

  function continueSetup() {
    onboarding.setLastRoute(continueTo);
    navigate(continueTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-[460px] flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tn-success-bg">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-tn-success"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <h1 className="m-0 mb-1.5 font-sans text-[24px] font-semibold text-tn-ink">
            Payment received, {firstName}!
          </h1>
          <p className="m-0 font-sans text-sm text-tn-muted-5">
            Your iGroom account is ready. Next, a couple of quick details about your shop — then you
            can start taking bookings.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-xl border border-tn-border p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Invoice #</span>
            <span className="font-sans text-xs font-medium text-tn-ink">{invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Date</span>
            <span className="font-sans text-xs font-medium text-tn-ink">{date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Plan</span>
            <span className="font-sans text-xs font-medium text-tn-ink">{plan.name} · 4 seats</span>
          </div>
          <div className="h-px bg-tn-border-softer" />
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-semibold text-tn-ink">Total paid</span>
            <span className="font-sans text-sm font-semibold text-tn-ink">
              {formatMoney(plan.priceCents, plan.currency)}
            </span>
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="mt-1 cursor-not-allowed self-start font-sans text-xs font-medium text-tn-muted-6 underline decoration-dotted"
          >
            Download PDF
          </button>
        </div>

        <Button size="lg" className="w-full" onClick={continueSetup}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export default ReceiptPage;
