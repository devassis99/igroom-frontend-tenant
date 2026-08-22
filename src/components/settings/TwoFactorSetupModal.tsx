import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError } from "@/lib/http";
import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@/lib/accounts-api";

interface TwoFactorSetupModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  /** Which flow to show — SecuritySettingsPage decides based on staffUser.mfaEnabled. */
  mfaEnabled: boolean;
  /** Called after 2FA is successfully enabled or disabled — SecuritySettingsPage uses this to toast and refetch /accounts/me. */
  onSuccess: (justEnabled: boolean) => void;
}

/**
 * Security page's "Two-factor authentication" row. A caller without 2FA
 * gets a QR code the moment this opens (see beginMfaSetup — the secret is
 * stored pending, not yet active) to scan with an authenticator app, then
 * enters the first code it shows to confirm and turn 2FA on. A caller
 * with 2FA already enabled skips straight to entering a code to turn it
 * off — same live-code proof either way, no password fallback (matches
 * security.service.ts's disableMfa, which intentionally has none: losing
 * the device means asking support, same as bo_users' MFA reset).
 */
export function TwoFactorSetupModal({
  open,
  onClose,
  accessToken,
  mfaEnabled,
  onSuccess,
}: TwoFactorSetupModalProps) {
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      requestedRef.current = false;
      return;
    }
    setCode("");
    setSubmitError(null);
    setSetup(null);
    setSetupError(null);
    if (!mfaEnabled && !requestedRef.current) {
      requestedRef.current = true;
      setSetupLoading(true);
      beginMfaSetup(accessToken)
        .then((result) => setSetup(result))
        .catch((err) => {
          setSetupError(
            err instanceof ApiError ? err.message : "Couldn't start setup — try again.",
          );
        })
        .finally(() => setSetupLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessToken identity changing shouldn't re-trigger a fresh setup call while the modal's already open
  }, [open, mfaEnabled]);

  const canSubmit = code.length === 6 && !submitting && (mfaEnabled || Boolean(setup));

  /**
   * Takes the code directly (rather than reading `code` off closure alone)
   * so OtpInput's onComplete can auto-submit the instant the 6th digit
   * lands, same pattern as LoginPage.tsx/CreateAccountPage.tsx's MFA
   * challenge step — OtpInput itself handles focusing its first box on
   * mount (see its own comment on why that's a ref/useEffect internally
   * rather than an `autoFocus` prop), replacing the codeInputRef this
   * modal used to manage by hand.
   */
  function submitCode(value: string) {
    if (value.length !== 6 || submitting || (!mfaEnabled && !setup)) return;
    setSubmitting(true);
    setSubmitError(null);
    const request = mfaEnabled
      ? disableMfa(accessToken, value)
      : confirmMfaSetup(accessToken, value);
    request
      .then(() => {
        onSuccess(!mfaEnabled);
        onClose();
        return;
      })
      .catch((err) => {
        setSubmitError(err instanceof ApiError ? err.message : "Incorrect code — try again.");
        setCode("");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className="flex flex-col gap-5 p-6">
        <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
          {mfaEnabled ? "Turn off two-factor authentication" : "Set up two-factor authentication"}
        </p>

        {!mfaEnabled && (
          <>
            {setupLoading && (
              <p className="m-0 font-sans text-xs text-tn-muted-5">Generating your QR code…</p>
            )}
            {setupError && (
              <p className="m-0 rounded-lg bg-tn-danger-bg px-3 py-2 font-sans text-xs text-tn-danger">
                {setupError}
              </p>
            )}
            {setup && (
              <div className="flex flex-col items-center gap-3">
                <p className="m-0 font-sans text-xs text-tn-muted-5">
                  Scan this with your authenticator app (Google Authenticator, Authy, 1Password,
                  etc.)
                </p>
                <img
                  src={setup.qrCodeDataUrl}
                  alt="Scan this QR code with your authenticator app"
                  className="h-40 w-40 rounded-lg border border-tn-border-soft"
                />
                <p className="m-0 break-all text-center font-sans text-[11px] text-tn-muted-6">
                  Can&rsquo;t scan? Enter this code manually: <strong>{setup.secret}</strong>
                </p>
              </div>
            )}
          </>
        )}

        {mfaEnabled && (
          <p className="m-0 font-sans text-xs text-tn-muted-5">
            Enter the code from your authenticator app to confirm it&rsquo;s really you before
            turning this off.
          </p>
        )}

        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submitCode}
          disabled={submitting || (!mfaEnabled && !setup)}
        />

        {submitError && (
          <p className="m-0 rounded-lg bg-tn-danger-bg px-3 py-2 font-sans text-xs text-tn-danger">
            {submitError}
          </p>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={mfaEnabled ? "danger" : "primary"}
            className="flex-1"
            onClick={() => submitCode(code)}
            disabled={!canSubmit}
          >
            {submitting ? "Saving…" : mfaEnabled ? "Turn off" : "Enable"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default TwoFactorSetupModal;
