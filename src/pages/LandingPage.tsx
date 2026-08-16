import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/auth/auth-store";
import { useOnboardingStore } from "@/auth/onboarding-store";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  {
    title: "Get discovered",
    body: "Show up in search and nearby listings for local clients.",
  },
  {
    title: "Manage bookings & walk-ins",
    body: "One queue for scheduled appointments and walk-ins.",
  },
  {
    title: "Get paid faster",
    body: "Accept deposits and full payments right in the app.",
  },
];

/** Matches the mockup's T1 landing/marketing frame — the public entry point at "/". */
export function LandingPage() {
  const navigate = useNavigate();
  const hasSession = useAuthStore((s) => s.owner !== null);
  // A visitor who abandoned signup partway through CAN resume at whichever
  // step they were last on (see onboarding-store.ts's lastRoute) — but
  // "Get Started" always opens the actual signup form (step 1) so it never
  // silently skips it. Resuming further in is an explicit choice via the
  // banner below, shown only once there's real progress to resume.
  const lastSignupRoute = useOnboardingStore((s) => s.lastRoute);
  const hasSignupInProgress = lastSignupRoute !== "/signup";

  function startSignup() {
    navigate("/signup");
  }

  function resumeSignup() {
    navigate(lastSignupRoute);
  }

  return (
    <div className="min-h-screen bg-tn-surface">
      <header className="flex items-center justify-between px-16 py-6">
        <span className="font-serif text-xl font-semibold text-tn-ink">iGroom for Business</span>
        <nav className="flex items-center gap-7 font-sans text-sm font-medium text-tn-muted-2">
          <span className="hidden sm:inline">Features</span>
          <span className="hidden sm:inline">Pricing</span>
          <span className="hidden sm:inline">Support</span>
          <button
            type="button"
            onClick={() => navigate(hasSession ? "/dashboard" : "/login")}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-sm font-medium text-tn-gold"
          >
            Log in
          </button>
          <Button onClick={startSignup}>Get Started</Button>
        </nav>
      </header>

      {hasSignupInProgress && (
        <div className="flex items-center justify-center gap-2 bg-tn-gold-bg-soft px-4 py-2.5 text-center">
          <p className="m-0 font-sans text-xs text-tn-ink">
            Looks like you started setting up your shop.
          </p>
          <button
            type="button"
            onClick={resumeSignup}
            className="cursor-pointer border-none bg-transparent p-0 font-sans text-xs font-semibold text-tn-gold underline"
          >
            Continue where you left off →
          </button>
        </div>
      )}

      <section className="flex items-center gap-16 px-16 pb-14 pt-10">
        <div className="flex flex-1 flex-col gap-5">
          <h1 className="m-0 font-serif text-5xl font-semibold leading-tight text-tn-ink">
            List your shop on iGroom
          </h1>
          <p className="m-0 max-w-md font-sans text-lg leading-relaxed text-tn-muted-4">
            Reach new clients, manage bookings and walk-ins, and get paid — all in one place.
          </p>
          <div className="mt-2 flex gap-3.5">
            <Button size="lg" onClick={startSignup}>
              Get Started
            </Button>
            <Button size="lg" variant="secondary">
              Watch Demo
            </Button>
          </div>
        </div>
        <div
          className="flex h-[280px] flex-1 items-center justify-center rounded-2xl text-xs font-mono text-tn-muted-5"
          style={{
            background:
              "repeating-linear-gradient(45deg, oklch(90% 0.015 65), oklch(90% 0.015 65) 8px, oklch(94% 0.01 70) 8px, oklch(94% 0.01 70) 16px)",
          }}
        >
          dashboard preview
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-16 pb-14 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-2.5 rounded-2xl border border-tn-border p-6"
          >
            <span className="text-xl text-tn-gold" aria-hidden>
              ★
            </span>
            <p className="m-0 font-sans text-[15px] font-semibold text-tn-ink">{feature.title}</p>
            <p className="m-0 font-sans text-[13px] leading-relaxed text-tn-muted-5">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <footer className="px-16 pb-10">
        <Link to="/signup" className="font-sans text-xs text-tn-muted-6">
          igroom.io/partners
        </Link>
      </footer>
    </div>
  );
}

export default LandingPage;
