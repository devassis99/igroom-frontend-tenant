import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, formInputClass } from "@/components/ui/FormField";
import { OtpInput } from "@/components/ui/OtpInput";
import { ApiError } from "@/lib/http";
import { requestPasswordResetCode, confirmSetPassword } from "@/lib/accounts-api";

/** Matches the backend's staffPasswordResetCodes cooldown (security.service.ts's RESET_CODE_RESEND_COOLDOWN_MS) — purely cosmetic here, the backend is the real enforcement. */
const RESEND_COOLDOWN_S = 60;

interface SetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  /** Wording only ("Set" vs "Change") — both call the same confirm endpoint. */
  hasPassword: boolean;
  /** True → ask for an authenticator app code instead of emailing one (see accounts.service.ts's confirmSetPassword). */
  mfaEnabled: boolean;
  /** Called after the password is confirmed set — SecuritySettingsPage uses this to toast and refetch /accounts/me. */
  onSuccess: () => void;
}

/**
 * Security page's Set/Change password flow. A caller without 2FA gets a
 * code emailed automatically the moment this opens (rate-limited
 * server-side, resendable here after a cooldown); a caller with 2FA
 * enabled skips straight to entering an authenticator code — same
 * mfaEnabled branch accounts.service.ts's confirmSetPassword checks, so
 * the UI here can't ask for the wrong kind of code. Both paths land on
 * the same new-password fields and the same submit, which on success
 * also triggers a "your password was reset" confirmation email
 * server-side.
 */
export function SetPasswordModal({
  open,
  onClose,
  accessToken,
  hasPassword,
  mfaEnabled,
  onSuccess,
}: SetPasswordModalProps) {
  const [code, setCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // StrictMode/effect-cleanup guard so a fast open/close/open doesn't fire
  // two overlapping "send code" requests for the same modal mount.
  const requestedRef = useRef(false);

  function sendCode() {
    setSendingCode(true);
    setCodeError(null);
    requestPasswordResetCode(accessToken)
      .then(() => setCooldown(RESEND_COOLDOWN_S))
      .catch((err) => {
        setCodeError(err instanceof ApiError ? err.message : "Couldn't send the code — try again.");
      })
      .finally(() => setSendingCode(false));
  }

  // Fresh form + an automatic first send every time the modal opens
  // (email path only — a 2FA caller has nothing to send, their code
  // comes from an app they already have).
  useEffect(() => {
    if (!open) {
      requestedRef.current = false;
      return;
    }
    setCode("");
    setTotpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setCodeError(null);
    setSubmitError(null);
    setCooldown(0);
    if (!mfaEnabled && !requestedRef.current) {
      requestedRef.current = true;
      sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendCode is a stable-enough local closure; re-running this on every accessToken/mfaEnabled identity change would refire the send.
  }, [open, mfaEnabled]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    newPassword.length >= 8 &&
    passwordsMatch &&
    (mfaEnabled ? totpCode.length === 6 : code.length === 6);

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    confirmSetPassword(accessToken, {
      newPassword,
      code: mfaEnabled ? undefined : code,
      totpCode: mfaEnabled ? totpCode : undefined,
    })
      .then(() => {
        onSuccess();
        onClose();
        return;
      })
      .catch((err) => {
        setSubmitError(
          err instanceof ApiError ? err.message : "Couldn't update your password — try again.",
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className="flex flex-col gap-5 p-6">
        <p className="m-0 font-sans text-lg font-semibold text-tn-ink">
          {hasPassword ? "Change password" : "Set password"}
        </p>

        {mfaEnabled ? (
          <Field label="AUTHENTICATOR CODE">
            <OtpInput value={totpCode} onChange={setTotpCode} disabled={submitting} />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Field label="VERIFICATION CODE">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={sendingCode ? "Sending…" : "6-digit code"}
                className={formInputClass}
              />
            </Field>
            <div className="flex items-center justify-between font-sans text-xs">
              <span className="text-tn-muted-5">
                {codeError ?? "We emailed a code to confirm it's really you."}
              </span>
              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || cooldown > 0}
                className="cursor-pointer border-none bg-transparent p-0 font-sans text-xs font-semibold text-tn-blue disabled:cursor-not-allowed disabled:text-tn-faint-2"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        <Field label="NEW PASSWORD">
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={formInputClass}
          />
        </Field>

        <Field label="CONFIRM NEW PASSWORD">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={formInputClass}
          />
        </Field>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="m-0 -mt-3 font-sans text-xs text-tn-danger">Passwords don&rsquo;t match</p>
        )}

        {submitError && (
          <p className="m-0 rounded-lg bg-tn-danger-bg px-3 py-2 font-sans text-xs text-tn-danger">
            {submitError}
          </p>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SetPasswordModal;
