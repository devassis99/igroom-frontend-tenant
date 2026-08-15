import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";

const CATEGORIES = ["Barbershop", "Hair Salon", "Nails", "Spa"];

/** Matches the mockup's T3 "Tell us about your business" frame, step 2 of 2. */
export function BusinessDetailsPage() {
  const navigate = useNavigate();
  const { businessName, category, address, phone, setBusinessDetails } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !address.trim() || !phone.trim()) {
      setError("Fill in your business name, address, and phone to continue.");
      return;
    }
    navigate("/signup/plan");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-serif text-[28px] font-semibold text-tn-ink">
            Tell us about your business
          </h1>
          <p className="m-0 font-sans text-[13px] text-tn-muted-5">Step 2 of 2</p>
        </div>

        <StepProgress step={2} total={2} />

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

        <Field label="ADDRESS">
          <input
            type="text"
            placeholder="412 Congress Ave, Austin, TX"
            value={address}
            onChange={(e) => setBusinessDetails({ address: e.target.value })}
            className={formInputClass}
          />
        </Field>

        <Field label="BUSINESS PHONE">
          <input
            type="tel"
            placeholder="(512) 555-0100"
            value={phone}
            onChange={(e) => setBusinessDetails({ phone: e.target.value })}
            className={formInputClass}
          />
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
