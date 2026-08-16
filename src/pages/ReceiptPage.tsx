import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/Button";
import { signup } from "@/lib/accounts-api";
import { setMyAvailability } from "@/lib/availability-api";
import { ApiError } from "@/lib/http";

interface ReceiptData {
  ownerFirstName: string;
  businessName: string;
  planName: string;
  seats: number;
  priceCents: number;
  currency: string;
  invoiceNumber: string;
  date: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase() || "USD",
  }).format(cents / 100);
}

/**
 * Matches the mockup's T5 "Application Submitted" frame — where Stripe
 * redirects (success_url — see accounts.service.ts's
 * createCheckoutSession) once the visitor finishes paying. Everything
 * else signup needs (owner credentials, business details, the picked
 * plan, and an optional weekly schedule — see onboarding-store.ts) is
 * already sitting in the onboarding store by the time a visitor lands
 * here, so this page is what actually calls POST /accounts/signup,
 * verifying this exact Checkout Session server-side before the account
 * is created. If a weekly schedule was set (not skipped) on
 * StaffAvailabilityPage, it's submitted here too, right after — that's
 * the earliest point a real staffUser/accessToken exists to submit it
 * with.
 *
 * Copy note: the mockup's frame reads like a manual-review flow ("we're
 * reviewing your application... this usually takes less than 24
 * hours"), but accounts.service.ts's signup() creates an
 * active/trialing account instantly — there's no review queue. The copy
 * below reflects that instant activation instead of the mockup's
 * review-queue wording; flag if a manual-review model was actually
 * intended and this should show a pending state instead.
 *
 * Reads Stripe's one-time `?session_id=` the moment it arrives and
 * persists it to the onboarding store (stripeCheckoutSessionId) so a
 * manual URL edit, reload, or resume-via-lastRoute after that doesn't
 * force a second real Stripe Checkout — see onboarding-store.ts's
 * comment on that field. A reload after a successful run (wizard state
 * already cleared) falls through to signup()'s 409 "already exists" /
 * "already used" errors below, which point at logging in instead.
 */
export function ReceiptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("session_id");
  const onboarding = useOnboardingStore();
  const loginWithSession = useAuthStore((s) => s.loginWithSession);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const startedRef = useRef(false);

  const plan = onboarding.selectedPlan;
  const effectiveSessionId = urlSessionId ?? onboarding.stripeCheckoutSessionId;

  useEffect(() => {
    if (urlSessionId) {
      onboarding.setStripeCheckoutSessionId(urlSessionId);
      // A real Stripe payment already went through the moment this URL
      // param shows up — from here on, Plan/Checkout are irrelevant to
      // resuming (re-visiting them would mean paying a second time for
      // an already-paid signup). Recording this as the resume point
      // means a visitor who checks out then closes the tab before the
      // signup() effect below finishes comes back straight here (via
      // LandingPage's "Continue where you left off"), not to
      // /signup/plan. reset() below clears this back to "/signup" the
      // moment signup() actually succeeds.
      onboarding.setLastRoute("/signup/receipt");
    }
    // Only re-run when the URL param itself changes — onboarding's
    // setter identity is stable across renders (zustand).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  useEffect(() => {
    if (startedRef.current) return;
    if (!plan || !effectiveSessionId || !onboarding.businessName) {
      // Landed here without finishing the earlier steps (bookmark, back
      // button, or a checkout session that never actually completed) —
      // send back to pick a plan rather than letting signup() fail with
      // a confusing error.
      navigate("/signup/plan", { replace: true });
      return;
    }
    startedRef.current = true;

    (async () => {
      try {
        const tokens = await signup({
          fullName: onboarding.fullName || "Sam Whitfield",
          workEmail: onboarding.workEmail,
          password: onboarding.googleIdToken ? undefined : onboarding.password,
          googleIdToken: onboarding.googleIdToken ?? undefined,
          businessName: onboarding.businessName,
          category: onboarding.category,
          phone: onboarding.phone,
          planKey: plan.key,
          billingCycle: onboarding.billingCycle,
          stripeCheckoutSessionId: effectiveSessionId,
        });

        // Best-effort — availability is skippable everywhere else too,
        // so a failure here shouldn't block finishing signup.
        if (onboarding.availabilityDays) {
          try {
            await setMyAvailability(tokens.accessToken, onboarding.availabilityDays);
          } catch {
            // Ignored — the owner can always set this later in Settings.
          }
        }

        loginWithSession({
          owner: {
            fullName: onboarding.fullName || "Sam Whitfield",
            workEmail: onboarding.workEmail,
            businessName: onboarding.businessName,
            category: onboarding.category,
            address: "",
            phone: onboarding.phone,
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

        setReceipt({
          ownerFirstName: (onboarding.fullName || "Sam Whitfield").split(" ")[0] ?? "there",
          businessName: onboarding.businessName,
          planName: plan.name,
          seats: 4,
          priceCents: plan.priceCents,
          currency: plan.currency,
          invoiceNumber: `INV-${effectiveSessionId.slice(-8).toUpperCase()}`,
          date: new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        });
        // Signup is done — clear the localStorage-persisted wizard state
        // (see onboarding-store.ts) so a later visit to /signup doesn't
        // resurrect this finished attempt's email/plan/etc.
        onboarding.reset();
      } catch (err) {
        // igroom-backend's signup() throws a 409 ConflictError both for
        // "email already exists" and "this checkout session was already
        // used" — the latter can legitimately happen on a reload of this
        // page after an earlier successful run already cleared the
        // wizard state, so point at logging in rather than a dead end.
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

  function goToDashboard() {
    navigate("/redirecting", { state: { to: "/dashboard" }, replace: true });
  }

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

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
        <p className="m-0 font-sans text-sm text-tn-muted-5">Finishing checkout…</p>
      </div>
    );
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
          <h1 className="m-0 mb-1.5 font-serif text-[26px] font-semibold text-tn-ink">
            You&rsquo;re all set, {receipt.ownerFirstName}!
          </h1>
          <p className="m-0 font-sans text-sm text-tn-muted-5">
            {receipt.businessName} is live on iGroom — you can start taking bookings right away.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-xl border border-tn-border p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Invoice #</span>
            <span className="font-sans text-xs font-medium text-tn-ink">
              {receipt.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Date</span>
            <span className="font-sans text-xs font-medium text-tn-ink">{receipt.date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-tn-muted-5">Plan</span>
            <span className="font-sans text-xs font-medium text-tn-ink">
              {receipt.planName} · {receipt.seats} seats
            </span>
          </div>
          <div className="h-px bg-tn-border-softer" />
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-semibold text-tn-ink">Total paid</span>
            <span className="font-sans text-sm font-semibold text-tn-ink">
              {formatMoney(receipt.priceCents, receipt.currency)}
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

        <Button size="lg" className="w-full" onClick={goToDashboard}>
          Go to Owner Dashboard
        </Button>
      </div>
    </div>
  );
}

export default ReceiptPage;
