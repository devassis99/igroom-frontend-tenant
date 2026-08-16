import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { BILLING_CYCLE_LABEL, type BillingCycle } from "@/lib/sample-data";
import {
  getCatalog,
  monthlyEquivalentDollars,
  priceForCycle,
  type CatalogProduct,
} from "@/lib/billing-api";
import { createCheckoutSession } from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";

const CYCLES: BillingCycle[] = ["monthly", "quarterly", "biannual", "annual"];

// Stable empty-array fallback — a fresh `[]` literal on every render would make
// the useMemo hooks below think `products` changed even when it didn't.
const EMPTY_PRODUCTS: CatalogProduct[] = [];

const CYCLE_SUBTITLE: Record<BillingCycle, string> = {
  monthly: "",
  quarterly: " · billed quarterly",
  biannual: " · billed every 6 months",
  annual: " · billed annually",
};

/**
 * Computes the "SAVE X%" badge on the Annual tab from real data — the
 * first plan with both an active month and year price — rather than a
 * hardcoded percentage, so it stays correct if the back office's Plans
 * page ever prices annual differently than a flat 20% off.
 */
function computeAnnualDiscountPercent(products: CatalogProduct[]): number | null {
  for (const product of products) {
    const monthPrice = product.prices.find((p) => p.billingInterval === "month" && p.isActive);
    const yearPrice = product.prices.find((p) => p.billingInterval === "year" && p.isActive);
    if (monthPrice && yearPrice && monthPrice.unitAmount > 0) {
      const discount = 1 - yearPrice.unitAmount / 12 / monthPrice.unitAmount;
      if (discount > 0) return Math.round(discount * 100);
    }
  }
  return null;
}

/**
 * Which cycles have at least one product priced for them — a cycle with
 * zero priced plans across the whole catalog is hidden entirely rather
 * than shown as an empty/dead tab (per the "show price on self signup"
 * requirement: no price anywhere for a cycle means the cycle itself
 * doesn't appear).
 */
function availableCycles(products: CatalogProduct[]): BillingCycle[] {
  return CYCLES.filter((cycle) => products.some((product) => priceForCycle(product, cycle)));
}

/**
 * Matches the mockup's T3b–T3e "Choose your plan" frames — one page,
 * billing cycle as a tab. Step 2 of 3 (Account → Plan → Business
 * details — Stripe's real hosted Checkout happens in between, but it's
 * an external redirect, not an in-app wizard step). Plans and prices
 * come from igroom-backend's public GET /billing/products (see
 * billing-api.ts) — the same catalog managed from the back office's
 * Plans page, not a hardcoded list. Only products the admin has marked
 * showOnSignup reach this endpoint at all; on top of that, a plan with
 * no price for the selected cycle is hidden here (not shown disabled),
 * and a cycle with no priced plans at all is hidden from the tab row
 * entirely.
 *
 * Picking a plan goes straight to Stripe — no in-app "review your
 * order" screen in between. POST /accounts/checkout-session
 * (accounts-api.ts) creates the real Checkout Session and the browser is
 * redirected immediately; Stripe's cancel_url points back here
 * (?canceled=1) if the visitor backs out.
 */
export function ChoosePlanPage() {
  const [searchParams] = useSearchParams();
  const { billingCycle, setBillingCycle, workEmail, selectPlan } = useOnboardingStore();
  const [redirectingProductId, setRedirectingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canceled = searchParams.get("canceled") === "1";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["billing", "catalog"],
    queryFn: getCatalog,
  });

  const products = useMemo(() => data?.products ?? EMPTY_PRODUCTS, [data]);
  const annualDiscount = computeAnnualDiscountPercent(products);
  const cycles = useMemo(() => availableCycles(products), [products]);
  const visibleProducts = useMemo(
    () => products.filter((product) => priceForCycle(product, billingCycle)),
    [products, billingCycle],
  );

  // If the previously-selected (or default) cycle has no priced plans
  // once real catalog data loads, fall back to the first cycle that
  // does, so the page never lands on a dead/empty selection.
  useEffect(() => {
    if (cycles.length === 0) return;
    if (!cycles.includes(billingCycle)) {
      setBillingCycle(cycles[0]!);
    }
  }, [cycles, billingCycle, setBillingCycle]);

  async function handleSelect(product: CatalogProduct) {
    const price = priceForCycle(product, billingCycle);
    if (!price || redirectingProductId) return;

    setError(null);
    setRedirectingProductId(product.id);
    // Stashed before the redirect (in sessionStorage — see
    // onboarding-store.ts) so BusinessDetailsPage still has the chosen
    // plan once Stripe sends the browser back from checkout.stripe.com.
    selectPlan({
      productId: product.id,
      key: product.key,
      name: product.name,
      priceCents: price.unitAmount,
      currency: price.currency,
      trialDays: product.trialDays,
    });
    try {
      const session = await createCheckoutSession({
        planKey: product.key,
        billingCycle,
        email: workEmail || undefined,
      });
      window.location.href = session.url;
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't start checkout — try again.";
      setError(message);
      setRedirectingProductId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-tn-plan-bg px-6 py-14">
      <div className="text-center">
        <h1 className="m-0 mb-1.5 font-serif text-[30px] font-semibold text-tn-on-dark">
          Choose your plan
        </h1>
        <p className="m-0 font-sans text-sm text-tn-page/80">
          Step 2 of 3 · billed per chair, cancel anytime{CYCLE_SUBTITLE[billingCycle]}
        </p>
      </div>

      {canceled && (
        <p className="m-0 max-w-md rounded-lg bg-tn-danger-bg px-3.5 py-2 text-center font-sans text-xs text-tn-danger">
          Checkout was canceled — no charge was made. Pick a plan whenever you're ready.
        </p>
      )}

      {error && (
        <p className="m-0 max-w-md rounded-lg bg-tn-danger-bg px-3.5 py-2 text-center font-sans text-xs text-tn-danger">
          {error}
        </p>
      )}

      {cycles.length > 0 && (
        <div className="flex gap-0.5 rounded-full bg-tn-plan-track p-[3px]">
          {cycles.map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-[7px] font-sans text-xs ${
                cycle === billingCycle
                  ? "font-semibold text-tn-ink bg-tn-gold-soft"
                  : "font-medium text-tn-page/80"
              }`}
            >
              {BILLING_CYCLE_LABEL[cycle]}
              {cycle === "annual" && annualDiscount !== null && (
                <span className="rounded-full bg-tn-gold-bg px-1.5 py-0.5 font-sans text-[9px] font-semibold text-tn-gold">
                  SAVE {annualDiscount}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="font-sans text-sm text-tn-page/80">Loading plans…</p>}

      {isError && (
        <p className="font-sans text-sm text-tn-danger">
          Couldn&rsquo;t load plans right now — refresh to try again.
        </p>
      )}

      {!isLoading && !isError && visibleProducts.length === 0 && (
        <p className="font-sans text-sm text-tn-page/80">
          No plans are available right now — check back soon.
        </p>
      )}

      {!isLoading && !isError && visibleProducts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-5">
          {visibleProducts.map((product, i) => {
            const price = priceForCycle(product, billingCycle);
            const isTrial = i === 0 && product.trialDays > 0;
            const isRedirecting = redirectingProductId === product.id;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelect(product)}
                disabled={redirectingProductId !== null}
                className={`flex w-[220px] flex-col rounded-2xl p-1.5 text-left disabled:cursor-not-allowed ${
                  redirectingProductId !== null && !isRedirecting ? "opacity-50" : ""
                } ${isTrial ? "bg-tn-gold-soft" : "bg-tn-surface"}`}
              >
                {isTrial ? (
                  <p className="m-0 px-3.5 py-2 font-sans text-[11px] font-bold tracking-[0.04em] text-[oklch(28%_0.06_60)]">
                    {product.trialDays}-DAY FREE TRIAL
                  </p>
                ) : (
                  <div className="h-[29px]" />
                )}
                <div
                  className={`flex flex-1 flex-col gap-3.5 rounded-xl p-[22px_18px] ${isTrial ? "bg-tn-surface" : ""}`}
                >
                  <p className="m-0 font-sans text-xs font-bold tracking-[0.03em] text-tn-dark">
                    {product.name.toUpperCase()}
                  </p>
                  <p className="m-0 font-sans text-[34px] font-bold text-tn-ink">
                    ${monthlyEquivalentDollars(price!)}
                    <span className="font-sans text-sm font-normal text-tn-muted-5">/mo</span>
                  </p>
                  <div className="h-px bg-tn-border-softer" />
                  <p className="m-0 whitespace-pre-line font-sans text-xs leading-relaxed text-tn-muted-4">
                    {product.features.join("\n")}
                  </p>
                  {isRedirecting && (
                    <p className="m-0 font-sans text-[11px] font-semibold text-tn-muted-5">
                      Redirecting to secure checkout…
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChoosePlanPage;
