declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            },
          ) => void;
        };
      };
    };
  }
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

let initializedClientId: string | null = null;
// Google Identity Services only keeps the callback from the *last*
// initialize() call — calling it more than once for the same client
// silently drops every earlier registration (the "initialize() is
// called multiple times" console warning this used to trigger, one full
// initialize() per signInWithGoogle() call, previously). Initializing
// exactly once and routing every rendered button's clicks through this
// single mutable callback avoids that — see renderGoogleButton below.
// Only one Google button is ever mounted at a time in this app
// (CreateAccountPage or LoginPage, never both), so a single global slot
// is enough; the most recently rendered button just owns it.
let currentCallback: ((idToken: string) => void) | null = null;

function ensureInitialized(clientId: string) {
  if (initializedClientId === clientId) return;
  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => currentCallback?.(response.credential),
  });
  initializedClientId = clientId;
}

/**
 * Renders Google's own "Sign in/up with Google" button into `container`;
 * `onCredential` fires with the signed ID token JWT every time the
 * visitor completes the flow (the button stays clickable afterwards, so
 * this can fire more than once — e.g. a retry after the caller's own
 * follow-up API call fails). That JWT is what igroom-backend's
 * /accounts/google verifies (see google.ts's verifyGoogleIdToken) —
 * never trust its contents client-side, it's only a carrier for the
 * server-side check.
 *
 * This replaces an earlier version that used One Tap's prompt() from a
 * custom-styled button's onClick. prompt() is meant for an
 * auto-appearing suggestion, not a direct response to a user's click —
 * Google silently suppresses it in plenty of ordinary situations
 * (third-party cookie/storage restrictions, per-origin frequency caps,
 * incognito), which showed up as a `403` on
 * accounts.google.com/gsi/status and a confusing "Google sign-in isn't
 * available right now" error on every click, with no real way to
 * recover short of the visitor changing browser settings. A real click
 * on Google's own rendered button doesn't have that suppression risk —
 * it's the flow Google's own docs recommend for an explicit "Sign in
 * with Google" button.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void,
  options?: { text?: "signin_with" | "signup_with" | "continue_with"; width?: number },
): Promise<void> {
  await loadGoogleIdentityScript();
  if (!window.google) throw new Error("Google Identity Services failed to load");
  ensureInitialized(clientId);
  currentCallback = onCredential;

  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: options?.text ?? "continue_with",
    width: options?.width ?? 400,
    logo_alignment: "left",
  });
}
