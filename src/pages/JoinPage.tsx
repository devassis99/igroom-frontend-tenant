import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { LinkedPlanSummary } from "@/components/signup/LinkedPlanSummary";
import { getSignupLink, type SignupLink } from "@/lib/billing-api";
import { ApiError } from "@/lib/http";

/**
 * Where a back-office signup link lands — `/join/<token>`, copied from a
 * price row on the BO Plans page and sent to a prospective shop.
 *
 * It is the ordinary self-signup funnel with the plan already decided:
 * this page shows which plan, then hands off to /signup. From there the
 * visitor does Account → Business details → Availability exactly as
 * anyone else would, and ChoosePlanPage — seeing `signupLinkToken` in
 * the onboarding store — goes straight to Stripe Checkout for the link's
 * price instead of showing the picker. The backend resolves the price
 * from the token at both checkout and signup, so nothing the browser
 * stores here can change what gets charged.
 *
 * Opening the same link again resumes where the visitor left off; a
 * different link swaps the plan but keeps whatever they already typed.
 */
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

  function start(selected: SignupLink) {
    // Already paid and only the account creation is outstanding — the
    // receipt page finishes that. Re-pointing the plan now could only
    // break it.
    if (onboarding.stripeCheckoutSessionId) {
      navigate("/signup/receipt");
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
    navigate(sameLink ? onboarding.lastRoute : "/signup");
  }

  function seeAllPlans() {
    onboarding.setSignupLinkToken(null);
    navigate("/signup");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <div className="flex w-[460px] max-w-full flex-col gap-[22px]">
        {isLoading && (
          <p className="m-0 text-center font-sans text-sm text-tn-muted-5">Loading your plan…</p>
        )}

        {(error || (!isLoading && !link)) && (
          <>
            <div>
              <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
                This link isn't working
              </h1>
              <p className="m-0 font-sans text-[13px] text-tn-muted-5">
                {error instanceof ApiError
                  ? error.message
                  : "We couldn't load the plan on this link. Check it was copied in full, or ask whoever sent it for a new one."}
              </p>
            </div>
            <Button type="button" onClick={seeAllPlans}>
              Sign up and choose a plan
            </Button>
          </>
        )}

        {link && (
          <>
            <div>
              <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
                Set up your shop on iGroom
              </h1>
              <p className="m-0 font-sans text-[13px] text-tn-muted-5">
                Your plan is ready — create your account, tell us about your business and set your
                hours, then confirm payment.
              </p>
            </div>

            <LinkedPlanSummary link={link} />

            <Button type="button" onClick={() => start(link)}>
              Get started
            </Button>

            <p className="m-0 text-center font-sans text-xs text-tn-muted-5">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-tn-gold">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default JoinPage;
