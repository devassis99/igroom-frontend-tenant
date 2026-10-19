import { type FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { useOnboardingStore, useSignupStep } from "@/auth/onboarding-store";
import { useAfterPaymentGate } from "@/components/signup/after-payment";
import { setBusinessDetails as saveBusinessDetails, type MeResponse } from "@/lib/accounts-api";
import { ApiError } from "@/lib/http";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { StepProgress } from "@/components/ui/StepProgress";
import { PhoneInput, isPhoneValid } from "@/components/ui/PhoneInput";
import { previewSlug, publicBookingUrl } from "@/lib/public-link";

const CATEGORIES = ["Barbershop", "Hair Salon", "Nails", "Spa"];

/**
 * Matches the mockup's T3 "Tell us about your business" frame — step 3
 * of 4 (Account → Plan → Business details → Availability), or 2 of 3 for
 * an invite link. It comes after payment: ReceiptPage has already
 * created the account under a placeholder name ("Jordan Rivera's shop"),
 * so this saves the real name, category and phone straight to it
 * (PUT /accounts/me/business), which also gives the shop its public
 * booking address. It follows the receipt (ReceiptPage), which is the
 * first screen after Stripe.
 *
 * It also names the first location on its own ("Downtown"), not after
 * the business: the booking link is <business>/<location>, and a first
 * branch that took the business name made every link read
 * igroom.io/the-gentry/the-gentry.
 *
 * A signed-in owner whose shop still has no name is sent back here from
 * anywhere in the app (ProtectedRoute), so it can't be skipped by closing
 * the tab — the booking page would otherwise go out under the
 * placeholder.
 */
export function BusinessDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const gate = useAfterPaymentGate();
  const step = useSignupStep("business");
  const updateOwner = useAuthStore((s) => s.updateOwner);
  const { businessName, locationName, category, phone, setBusinessDetails, setLastRoute } =
    useOnboardingStore();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Records "this is the step the visitor is currently on" so a later
  // resume click from LandingPage jumps back here instead of restarting
  // the wizard — see onboarding-store.ts's lastRoute comment.
  useEffect(() => {
    setLastRoute("/signup/business");
  }, [setLastRoute]);

  if (gate.state === "loading") return null;
  if (gate.state === "redirect") return <Navigate to={gate.to} replace />;
  const { accessToken } = gate;

  function continueToAvailability() {
    setLastRoute("/signup/availability");
    navigate("/signup/availability");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !locationName.trim() || !phone.trim()) {
      setError("Fill in your business name, location name and phone to continue.");
      return;
    }
    if (!isPhoneValid(phone)) {
      setError("That phone number doesn't look right for the selected country.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { account } = await saveBusinessDetails(accessToken, {
        businessName: businessName.trim(),
        locationName: locationName.trim(),
        category,
        phone,
      });
      updateOwner({ businessName: account.name, category, phone });
      // ProtectedRoute reads this from the cached /accounts/me; correct it
      // now, or the next protected page would send the owner straight back.
      queryClient.setQueryData<MeResponse>(["me", "permissions"], (old) =>
        old?.account ? { ...old, account: { ...old.account, needsBusinessDetails: false } } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      continueToAvailability();
    } catch (err) {
      // Already named — a second tab, or a resume after the save went
      // through. Nothing to redo here.
      if (err instanceof ApiError && err.status === 409) {
        continueToAvailability();
        return;
      }
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't save your business details — try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const linkPreview = publicBookingUrl(
    previewSlug(businessName) || "your-business",
    previewSlug(locationName) || "your-location",
  )?.replace(/^https?:\/\//, "");

  return (
    <div className="flex min-h-screen items-center justify-center bg-tn-surface px-6 py-12">
      <form onSubmit={handleSubmit} className="flex w-[460px] flex-col gap-[22px]">
        <div>
          <h1 className="m-0 mb-1.5 font-sans text-[24px] font-semibold text-tn-ink">
            Tell us about your business
          </h1>
          <p className="m-0 font-sans text-[14px] text-tn-muted-5">
            Step {step.number} of {step.total}
          </p>
        </div>

        <StepProgress step={step.number} total={step.total} />

        <Field label="BUSINESS NAME">
          <input
            type="text"
            placeholder="The Gentry Barbershop"
            value={businessName}
            onChange={(e) => setBusinessDetails({ businessName: e.target.value })}
            className={formInputClass}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <Field label="LOCATION NAME">
            <input
              type="text"
              placeholder="Downtown"
              value={locationName}
              onChange={(e) => setBusinessDetails({ locationName: e.target.value })}
              className={formInputClass}
            />
          </Field>
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            Your first shop — usually its area or street, like “Downtown” or “South Congress”. You
            can add more locations later.
            {linkPreview && (
              <>
                {" "}
                Your booking link will look like{" "}
                <span className="font-mono text-tn-ink">{linkPreview}</span>
              </>
            )}
          </p>
        </div>

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
                className={`rounded-full px-4 py-2 font-sans text-[14px] font-medium ${
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

        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}

export default BusinessDetailsPage;
