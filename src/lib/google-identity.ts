declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface PromptMomentNotification {
  isNotDisplayed: () => boolean;
  getNotDisplayedReason: () => string;
  isSkippedMoment: () => boolean;
  getSkippedReason: () => string;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

/** Loads Google Identity Services once and caches the in-flight/resolved promise. */
function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity Services")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Initializes Google Identity Services with our client ID and triggers
 * the "Sign In With Google" One Tap prompt, resolving with the signed ID
 * token JWT once the user picks an account. That JWT is what
 * igroom-backend's /accounts/google verifies (see google.ts's
 * verifyGoogleIdToken) — never trust its contents client-side, it's only
 * a carrier for the server-side check.
 *
 * Rejects if the prompt is suppressed — e.g. third-party sign-in is
 * blocked in this browser, or the user dismissed it earlier this
 * session (GIS applies a short cooldown after a dismissal). Callers
 * should catch this and fall back to the manual form.
 */
export async function signInWithGoogle(clientId: string): Promise<string> {
  await loadGoogleIdentityScript();
  const google = window.google;
  if (!google) throw new Error("Google Identity Services failed to load");

  return new Promise<string>((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => resolve(response.credential),
      // Opts into Chrome's FedCM-based prompt instead of the legacy
      // (soon-to-be-deprecated) One Tap UI — silences the GSI_LOGGER
      // console warning and avoids a future breakage when FedCM becomes
      // mandatory. See https://developers.google.com/identity/gsi/web/guides/fedcm-migration
      use_fedcm_for_prompt: true,
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(
          new Error(
            "Google sign-in isn't available right now — this can happen if third-party sign-in is blocked in your browser. Use the form below instead.",
          ),
        );
      }
    });
  });
}
