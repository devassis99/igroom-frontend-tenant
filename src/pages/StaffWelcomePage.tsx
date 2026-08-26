import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth-store";
import { usePermissions } from "@/auth/use-permissions";
import { useStaffOnboardingStore } from "@/auth/staff-onboarding-store";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { WizardTabs } from "@/components/ui/WizardTabs";
import { StaffAvailabilityEditor } from "@/components/availability/StaffAvailabilityEditor";
import { setInitialPassword, updateOwnProfile } from "@/lib/accounts-api";

const STEPS = ["Sign in", "About you", "Your hours"];

/**
 * What an invited staff member sees after redeeming their emailed link.
 *
 * Not the owner's signup funnel: they have an account already, and the
 * things the owner had to decide — the shop, its locations, the plan —
 * were decided for them. This wizard only covers what nobody else can
 * fill in on their behalf.
 *
 * Each step saves itself as it completes, rather than accumulating state
 * for one submit at the end the way the owner's funnel has to. The
 * session is real from the first render here, so there's no reason to
 * hold a password in memory across three screens.
 *
 * Locations are absent on purpose: creating one needs `locations.manage`,
 * which the non-owner roles don't hold, and the owner already chose where
 * this person works when they sent the invite.
 */
export function StaffWelcomePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { staffUser } = usePermissions();
  const onboarding = useStaffOnboardingStore();

  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(onboarding.name);
  const [displayTitle, setDisplayTitle] = useState("");
  const [bio, setBio] = useState("");
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => setInitialPassword(accessToken ?? "", password),
    onSuccess: () => {
      onboarding.markSignInMethodSet();
      setFormError(null);
      setStep(1);
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : "Couldn't set that password — try again."),
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      updateOwnProfile(accessToken ?? "", {
        name: name.trim() || undefined,
        displayTitle: displayTitle.trim() || null,
        bio: bio.trim() || null,
        specialties: specialtiesText
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        yearsExperience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
      }),
    onSuccess: () => {
      onboarding.setName(name.trim());
      setFormError(null);
      setStep(2);
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : "Couldn't save that — try again."),
  });

  function submitPassword() {
    if (password.length < 8) {
      setFormError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Those two passwords don't match.");
      return;
    }
    passwordMutation.mutate();
  }

  function finish() {
    onboarding.finish();
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen bg-tn-page px-6 py-10">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-lg font-semibold text-tn-ink">iGroom</span>
          <h1 className="m-0 font-serif text-[26px] font-semibold text-tn-ink">
            Welcome{onboarding.name ? `, ${onboarding.name.split(" ")[0]}` : ""}
          </h1>
          <p className="m-0 font-sans text-sm text-tn-muted-5">
            A couple of minutes and you&rsquo;re set up. Your shop and where you work are already
            sorted — this is the part only you can fill in.
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-tn-border bg-tn-surface p-6">
          <WizardTabs steps={STEPS} activeIndex={step} />

          {step === 0 && (
            <div className="flex max-w-[420px] flex-col gap-4">
              {onboarding.needsSignInMethod ? (
                <>
                  <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
                    Pick a password so you can sign back in later. Your invite link only worked
                    once, so this is what gets you in from now on.
                  </p>
                  <Field label="PASSWORD">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className={formInputClass}
                    />
                  </Field>
                  <Field label="CONFIRM PASSWORD">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={formInputClass}
                    />
                  </Field>
                  <p className="m-0 font-sans text-xs leading-relaxed text-tn-muted-5">
                    Prefer Google? You can sign in with Google using{" "}
                    <span className="font-semibold text-tn-ink-soft">{staffUser?.email}</span>{" "}
                    instead — set a password now anyway so you have a way in if that account ever
                    changes.
                  </p>
                </>
              ) : (
                <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
                  You&rsquo;re already set up to sign in, so there&rsquo;s nothing to do here. You
                  can change your password any time from Settings &rsaquo; Security.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex max-w-[520px] flex-col gap-4">
              <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
                This is what customers see when they book you. All optional — you can fill it in
                later from your profile.
              </p>
              <Field label="YOUR NAME">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={formInputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="DISPLAY TITLE">
                  <input
                    type="text"
                    value={displayTitle}
                    onChange={(e) => setDisplayTitle(e.target.value)}
                    placeholder="Senior Barber"
                    className={formInputClass}
                  />
                </Field>
                <Field label="YEARS EXPERIENCE">
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="—"
                    className={formInputClass}
                  />
                </Field>
              </div>
              <Field label="SPECIALTIES">
                <input
                  type="text"
                  value={specialtiesText}
                  onChange={(e) => setSpecialtiesText(e.target.value)}
                  placeholder="Skin fades, Beard sculpting"
                  className={formInputClass}
                />
              </Field>
              <p className="m-0 -mt-2 font-sans text-xs text-tn-muted-5">Separate with commas.</p>
              <Field label="ABOUT YOU">
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${formInputClass} resize-y`}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="m-0 font-sans text-sm leading-relaxed text-tn-muted-5">
                When can you be booked? Nobody can book you until this is set, so it&rsquo;s the one
                step worth doing now. You can change it any time from Settings &rsaquo;
                Availability.
              </p>
              {staffUser && (
                <StaffAvailabilityEditor staffUserId={staffUser.id} heading="Your weekly hours" />
              )}
            </div>
          )}

          {formError && <p className="m-0 font-sans text-sm text-tn-danger">{formError}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-tn-border-soft pt-4">
            <div>
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="cursor-pointer border-none bg-transparent p-0 font-sans text-[13px] font-semibold text-tn-muted-5 transition-colors duration-150 hover:text-tn-ink"
                >
                  Skip for now
                </button>
              )}
            </div>

            <div className="flex gap-2.5">
              {step > 0 && (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  &larr; Back
                </Button>
              )}
              {step === 0 && (
                <Button
                  onClick={onboarding.needsSignInMethod ? submitPassword : () => setStep(1)}
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? "Saving…" : "Next: About you →"}
                </Button>
              )}
              {step === 1 && (
                <Button
                  onClick={() => profileMutation.mutate()}
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? "Saving…" : "Next: Your hours →"}
                </Button>
              )}
              {/* The availability editor saves itself with its own Save
                  Changes button, so this only closes the wizard — it isn't
                  a second submit that could disagree with what was saved. */}
              {step === 2 && <Button onClick={finish}>Done — take me in</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaffWelcomePage;
