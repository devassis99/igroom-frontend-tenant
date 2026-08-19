import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";

const CATEGORIES = ["Barbershop", "Hair Salon", "Nails", "Spa"];

/**
 * Matches the mockup's T3 "Tell us about your business" frame — step 2 of
 * 4 (Account → Business details → Availability → Plan; Stripe's real
 * hosted Checkout and the new Receipt page follow Plan, both outside the
 * numbered wizard steps — see ChoosePlanPage's and ReceiptPage's
 * comments).
 *
 * This page just collects and stores businessName/category/phone — it no
 * longer calls POST /accounts/signup itself. Business details moved
 * ahead of payment so the account can actually be created (by
 * ReceiptPage, once checkout completes) with the real business name
 * already known, matching the mockup's T5 "Application Submitted" frame
 * which shows it on the receipt.
 */
export function BusinessDetailsPage() {
  const navigate = useNavigate();
  const { businessName, category, phone, setBusinessDetails, setLastRoute } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  // Records "this is the step the visitor is currently on" so a later
  // resume click from LandingPage jumps back here instead of restarting
  // the wizard — see onboarding-store.ts's lastRoute comment.
  useEffect(() => {
    setLastRoute("/signup/business");
  }, [setLastRoute]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !phone.trim()) {
      setError("Fill in your business name and phone to continue.");
      return;
    }
    if (!isPhoneValid(phone)) {
      setError("That phone number doesn't look right for the selected country.");
      return;
    }
    setError(null);
    navigate("/signup/availability");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Tell us about your business
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 2 of 4</p>
        </div>

        <StepProgress step={2} total={4} />

        <Field label="BUSINESS NAME">
          <input
            type="text"
            placeholder="The Gentry Barbershop"
            value={businessName}
            onChange={(e) => setBusinessDetails({ businessName: e.target.value })}
            className={formInputClass}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs font-medium tracking-[0.02em] text-tn-muted-1">
            CATEGORY
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBusinessDetails({ category: c })}
                className={`rounded-full px-4 py-2 font-sans text-[13px] font-medium ${
                  category === c ? "bg-tn-dark text-tn-on-dark" : "bg-tn-page text-tn-dark"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Field label="BUSINESS PHONE">
          <PhoneInput value={phone} onChange={(next) => setBusinessDetails({ phone: next })} />
        </Field>

        {error && <p className="m-0 font-sans text-xs text-tn-danger">{error}</p>}

        <Button type="submit" size="lg">
          Continue
        </Button>
      </form>
    </div>
  );
}

export default BusinessDetailsPage;
