/** Matches the mockup's T0 splash frame — shown for the brief tick while the persisted session rehydrates. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[22px] bg-tn-dark">
      <p className="m-0 font-serif text-[34px] font-semibold tracking-wide text-tn-on-dark">
        iGroom
      </p>
      <div
        className="h-9 w-9 rounded-full border-[3px] border-tn-muted-5 border-t-tn-gold-soft"
        style={{ animation: "tn-spin 0.9s linear infinite" }}
      />
      <p className="m-0 font-sans text-xs font-medium tracking-[0.04em] text-tn-page/80">
        LOADING YOUR DASHBOARD
      </p>
    </div>
  );
}

export default LoadingScreen;
