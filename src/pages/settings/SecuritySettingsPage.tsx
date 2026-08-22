import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/auth/use-permissions";
import { useAuthStore } from "@/auth/auth-store";
import { SetPasswordModal } from "@/components/settings/SetPasswordModal";
import { TwoFactorSetupModal } from "@/components/settings/TwoFactorSetupModal";
import { SuccessToast } from "@/components/ui/Toast";

/**
 * Matches the mockup's T12c Security page. The "Change password" row's
 * label/detail flex based on whether the caller has ever set a password
 * (staffUser.hasPassword, from GET /accounts/me — see accounts-api.ts) —
 * a Google-only sign-in (passwordHash still null) sees "Set password"
 * instead, since "Change" implies one already exists. Defaults to the
 * "Change password" wording while /accounts/me is still loading so the
 * common case (a password already set) doesn't flash the wrong label.
 *
 * Clicking that row opens SetPasswordModal, which asks for an emailed or
 * authenticator code (staffUser.mfaEnabled decides which — see that
 * component) before letting the new password through. "Two-factor
 * authentication" opens TwoFactorSetupModal, which enrolls (QR code + a
 * confirming code) or turns 2FA off (a live code) depending on that same
 * mfaEnabled flag — once enabled, login itself starts requiring a code
 * too (see LoginPage.tsx). "Active sessions" stays static, matching the
 * mockup — no real flow behind it yet.
 */
export function SecuritySettingsPage() {
  const { staffUser, isLoading } = usePermissions();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const hasPassword = isLoading || (staffUser?.hasPassword ?? true);
  const mfaEnabled = staffUser?.mfaEnabled ?? false;

  const [modalOpen, setModalOpen] = useState(false);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const rows = [
    {
      label: hasPassword ? "Change password" : "Set password",
      detail: hasPassword ? null : "No password set — you sign in with Google",
      onClick: () => setModalOpen(true),
    },
    {
      label: "Two-factor authentication",
      detail: mfaEnabled ? "Enabled" : "Not enabled",
      onClick: () => setMfaModalOpen(true),
    },
    { label: "Active sessions", detail: null, onClick: undefined },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">Security</h1>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-tn-border">
        {rows.map((row, i) => (
          <button
            key={row.label}
            type="button"
            onClick={row.onClick}
            disabled={!row.onClick}
            className={`flex items-center justify-between px-5 py-4 text-left disabled:cursor-default ${
              i < rows.length - 1 ? "border-b border-tn-border-soft" : ""
            }`}
          >
            <div>
              <span className="font-sans text-sm font-medium text-tn-ink-soft">{row.label}</span>
              {row.detail && (
                <p className="m-0 mt-0.5 font-sans text-xs text-tn-muted-5">{row.detail}</p>
              )}
            </div>
            <span className="text-tn-muted-6" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>

      {accessToken && (
        <SetPasswordModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          accessToken={accessToken}
          hasPassword={hasPassword}
          mfaEnabled={mfaEnabled}
          onSuccess={() => {
            // hasPassword flips true (and mfaEnabled would reflect any
            // future change too) the moment /accounts/me is refetched —
            // without this a first-time Set password would still say
            // "Set password" until the next full page load.
            queryClient.invalidateQueries({ queryKey: ["me", "permissions"] });
            setToast("Password updated — we've emailed you a confirmation.");
          }}
        />
      )}

      {accessToken && (
        <TwoFactorSetupModal
          open={mfaModalOpen}
          onClose={() => setMfaModalOpen(false)}
          accessToken={accessToken}
          mfaEnabled={mfaEnabled}
          onSuccess={(justEnabled) => {
            // Same refetch-so-the-row-updates-immediately reasoning as
            // SetPasswordModal's onSuccess above.
            queryClient.invalidateQueries({ queryKey: ["me", "permissions"] });
            setToast(
              justEnabled
                ? "Two-factor authentication enabled — we've emailed you a confirmation."
                : "Two-factor authentication turned off — we've emailed you a confirmation.",
            );
          }}
        />
      )}

      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default SecuritySettingsPage;
