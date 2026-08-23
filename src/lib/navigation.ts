/**
 * A one-slot registry for the app's navigate function.
 *
 * `http.ts` has to send the browser somewhere when a session dies, but it
 * sits outside the component tree, so it can't use `useNavigate`. It used
 * to import the router directly for that — which quietly made every module
 * importing `http.ts` (that is, every `*-api.ts`) depend on the entire
 * route tree, while the route tree depends on components that call those
 * APIs. Nothing closed the loop until `SupportSessionBar` (rendered by
 * `ProtectedRoute`) started calling `support-session-api`, and then
 * oxlint's `import/no-cycle` rightly refused the whole thing.
 *
 * Inverting the dependency fixes it at the root instead of at the newest
 * edge: this module imports nothing, `http.ts` reads from it, and
 * `routes/router.tsx` fills it in. Any api module added later is safe by
 * construction — `src/lib` no longer knows the route tree exists.
 */
type NavigateFn = (path: string) => void;

let navigate: NavigateFn | null = null;

/** Called once by routes/router.tsx, as soon as the router object exists. */
export function setAppNavigate(fn: NavigateFn): void {
  navigate = fn;
}

/**
 * Soft-navigate through the router when it has registered itself, falling
 * back to a full page load when it hasn't. The fallback only matters if
 * something calls the API before routes/router.tsx has been evaluated —
 * which the running app never does, since App.tsx imports it to render.
 */
export function navigateTo(path: string): void {
  if (navigate) {
    navigate(path);
  } else {
    window.location.assign(path);
  }
}
