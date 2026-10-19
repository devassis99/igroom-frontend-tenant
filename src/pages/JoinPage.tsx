import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { getSignupLink, type SignupLink } from "@/lib/billing-api";
import { ApiError } from "@/lib/http";

/**
 * Where an invite link lands — `/join/<token>`, from the BO Plans page's
 * Copy, its Create Payment Link modal, or the sales team's Convert to
 * shop.
 *
 * There is nothing to see here when the link works: it records the
 * link's plan in the onboarding store and goes straight into the
 * ordinary self-signup funnel (Account → Business details →
 * Availability), replacing itself in history so Back doesn't bounce off
 * it. ChoosePlanPage — seeing `signupLinkToken` in the store — then goes
 * straight to Stripe Checkout for the link's price instead of showing
 * the picker. The backend resolves the price from the token at both
 * checkout and signup, so nothing the browser stores here can change
 * what gets charged.
 *
 * Opening the same link again resumes where the visitor left off; a
 * different link swaps the plan but keeps whatever they already typed.
 *
 * The page only shows itself when the link doesn't work. Every link
 * expires, and works for one shop: once an account has been created
 * through it the backend answers 410 LINK_USED to anyone else. Each
 * reason gets its own message and next step (DEAD_LINK below) — "log in"
 * for a used one, "ask for a new one" for an expired one — instead of
 * one generic dead end.
 */

type DeadLinkCode = "LINK_USED" | "LINK_EXPIRED" | "LINK_DISABLED" | "PLAN_UNAVAILABLE";

const DEAD_LINK: Record<DeadLinkCode, { title: string; body: string }> = {
  LINK_USED: {
    title: "This invite has already been used",
    body: "A shop has already signed up to iGroom with this link — each invite works once. If that was you, log in. If not, ask whoever sent it for a new one.",
  },
  LINK_EXPIRED: {
    title: "This invite has expired",
    body: "Invite links only work for a limited time. Ask whoever sent it for a new one, or sign up and choose a plan yourself.",
  },
  LINK_DISABLED: {
    title: "This invite has been switched off",
    body: "Ask whoever sent it for a new one, or sign up and choose a plan yourself.",
  },
  PLAN_UNAVAILABLE: {
    title: "This plan isn't offered any more",
    body: "The plan on this invite has been retired. Ask whoever sent it for a new one, or sign up and choose a plan yourself.",
  },
};

/** The 410's `code` from the backend, when that's why the link isn't working. */
function deadLinkCode(error: unknown): DeadLinkCode | null {
  if (!(error instanceof ApiError) || error.status !== 410) return null;
  const code = (error.body as { code?: string } | undefined)?.code;
  return code && code in DEAD_LINK ? (code as DeadLinkCode) : null;
}

export function JoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const onboarding = useOnboardingStore();

  const { data, error, isLoading } = useQuery({
    queryKey: ["signup-link", token],
    queryFn: () => getSignupLink(token),
    enabled: token.length > 0,
    // A 404/409 is the answer, not a blip — retrying just delays it.
    retry: false,
  });
  const link = data?.signupLink;
  const deadCode = deadLinkCode(error);
  const dead = deadCode ? DEAD_LINK[deadCode] : null;
  // Paid on this link and only the account creation is left. That always
  // finishes, whatever has happened to the link since — the backend lets
  // a paid signup through an expired or used link — so it's offered even
  // when the link itself no longer loads.
  const paidOnThisLink =
    onboarding.stripeCheckoutSessionId !== null && onboarding.signupLinkToken === token;

  function start(selected: SignupLink) {
    // `replace` throughout: this page is only a doorway, and leaving it in
    // history would send Back straight here and forward again.
    //
    // Already paid and only the account creation is outstanding — the
    // receipt page finishes that. Re-pointing the plan now could only
    // break it.
    if (onboarding.stripeCheckoutSessionId) {
      navigate(onboarding.accountCreated ? onboarding.lastRoute : "/signup/receipt", {
        replace: true,
      });
      return;
    }

    const sameLink = onboarding.signupLinkToken === token;
    onboarding.setSignupLinkToken(token);
    onboarding.setBillingCycle(selected.billingCycle);
    onboarding.selectPlan({
      productId: selected.plan.productId,
      key: selected.plan.key,
      name: selected.plan.name,
      priceCents: selected.unitAmount,
      currency: selected.currency,
      trialDays: selected.trialDays,
    });
    navigate(sameLink ? onboarding.lastRoute : "/signup", { replace: true });
  }

  // A working link goes straight into signup — no landing page in between.
  useEffect(() => {
    if (link) start(link);
    // Once per loaded link: start() reads the store as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  function seeAllPlans() {
    onboarding.setSignupLinkToken(null);
    navigate("/signup");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-[460px] max-w-full flex-col gap-[22px]">
        {(isLoading || link) && (
          <p className="m-0 text-center font-sans text-sm text-tn-muted-5">Opening your invite…</p>
        )}

        {(error || (!isLoading && !link)) && paidOnThisLink && (
          <>
            <div>
              <h1 className="m-0 mb-1.5 font-sans text-[24px] font-semibold text-tn-ink">
                You're nearly done
              </h1>
              <p className="m-0 font-sans text-[14px] text-tn-muted-5">
                Your payment went through — all that's left is setting up your shop.
              </p>
            </div>
            <Button
              type="button"
              onClick={() =>
                navigate(onboarding.accountCreated ? onboarding.lastRoute : "/signup/receipt")
              }
            >
              Finish setting up
            </Button>
          </>
        )}

        {(error || (!isLoading && !link)) && !paidOnThisLink && (
          <>
            <div>
              <h1 className="m-0 mb-1.5 font-sans text-[24px] font-semibold text-tn-ink">
                {dead?.title ?? "This link isn't working"}
              </h1>
              <p className="m-0 font-sans text-[14px] text-tn-muted-5">
                {dead?.body ??
                  (error instanceof ApiError
                    ? error.message
                    : "We couldn't load the plan on this link. Check it was copied in full, or ask whoever sent it for a new one.")}
              </p>
            </div>
            {deadCode === "LINK_USED" ? (
              <div className="flex flex-col gap-2.5">
                <Button type="button" onClick={() => navigate("/login")}>
                  Log in
                </Button>
                <Button type="button" variant="secondary" onClick={seeAllPlans}>
                  Sign up and choose a plan
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={seeAllPlans}>
                Sign up and choose a plan
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default JoinPage;
