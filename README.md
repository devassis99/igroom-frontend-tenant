# igroom-frontend-tenant

React + TypeScript frontend for igroom **tenants** — shop owners who sign up, subscribe, and run
their business (calendar, waitlist, staff, customers, payments) on iGroom. This is the
customer-facing counterpart to `igroom-frontend-bo` (the platform's own back office): where `bo`
is iGroom managing shops, `tenant` is a shop managing itself.

## Stack, and why

Same stack as `igroom-frontend-bo`, for the same reasons (see that repo's README for the
long-form rationale on each choice) — one mental model across every igroom frontend:

| Concern            | Choice                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Package manager    | **pnpm** — matches `igroom-backend` and `igroom-frontend-bo`.                                                         |
| Build tool         | **Vite** — native-ESM dev server, Rollup production build.                                                            |
| Linting/formatting | **oxlint + oxfmt** — same configs as the other two repos.                                                             |
| Language           | **TypeScript, strict** — `strict: true` + `noUncheckedIndexedAccess`.                                                 |
| Routing            | **react-router v7** (data router) with route-level code splitting via `lazy`.                                         |
| Server state       | **TanStack Query** — wired up and tuned (`src/lib/query-client.ts`), not yet consuming any real endpoint (see below). |
| Client state       | **Zustand** — `src/auth/auth-store.ts` (mock session) and `src/auth/onboarding-store.ts` (in-flight signup wizard).   |
| Styling            | **Tailwind CSS v4** — design tokens in `src/styles/index.css`.                                                        |
| Tests              | **Vitest + Testing Library**.                                                                                         |

One deliberate difference from `bo`: no `@react-oauth/google`. `igroom-backend`'s only auth system
(`src/modules/auth`) is Google OAuth + mandatory TOTP for pre-provisioned `bo_users` rows — it has
no tenant/shop-owner signup or login endpoints at all. Wiring up a real Google button here would
have nothing to authenticate against, so the "Sign up with Google" button on the signup screen is
present (matches the mockup) but disabled, with a tooltip explaining why.

## What's real vs. mocked

**There is no tenant backend yet.** `igroom-backend` currently only has `auth` (for `bo_users`),
`billing` (Stripe _platform_ products/prices), `roles`, and `users` — nothing for shops, bookings,
staff, customers, services, or payments. So, same spirit as `bo`'s own "every number is
illustrative" approach, but one step further back: there's no session to bootstrap on load either.

- **The signup funnel is a real, stateful multi-step form** (`src/auth/onboarding-store.ts`
  collects it across routes) — full name, work email, password, business details, plan, billing
  cycle. It validates non-empty fields and won't let you skip ahead.
- **The Stripe checkout screen doesn't process payment.** Card fields are present and styled to
  match the mockup but not wired to Stripe.js (no publishable key, no backend to create a
  PaymentIntent against). Clicking "Subscribe" completes the mock signup and moves on.
- **"Signing up" creates a client-only session** (`src/auth/auth-store.ts`, persisted to
  `localStorage` like `bo`'s refresh token) rather than a real account. There's no server-side
  concept of this tenant to log back into from a different browser.
- **Every dashboard/calendar/waitlist/staff/customer/payment number is sample data**
  (`src/lib/sample-data.ts`), taken directly from the mockup's own illustrative numbers (The
  Gentry Barbershop, Sam Whitfield, Marcus/Devon/Ray, ...) — the same pattern `bo`'s
  `sample-data.ts` uses, so screens that share an entity (e.g. Dashboard's "by location" and
  Settings → Locations) don't drift from each other.
- **Interactions that don't need a backend are real**: the Services/Customers search boxes filter
  client-side, Calendar's day/week/month toggle actually switches views, the appointment detail →
  reschedule → cancel modal flow, the Waitlist list/board toggle, the Add Member 5-step wizard, and
  the billing-cycle tabs recomputing prices are all live UI state, not decoration.

`src/lib/http.ts`, `env.ts`, and `query-client.ts` are structured identically to `bo`'s, ready for
a tenant API to be dropped in — every `SAMPLE_*`/hardcoded value in `src/lib/sample-data.ts` is
meant to be replaced by a TanStack Query hook the moment `igroom-backend` has an endpoint for it.

## Deviations from the mockup, and why

- **Dashboard route is `/dashboard`, not `/`.** The mockup's own browser chrome shows
  `igroom.io/dashboard` for the authenticated app and `igroom.io/partners` for the public landing
  page — so this isn't really a deviation, just making the two explicit instead of both wanting
  `/`.
- **Integrations is a real route (`/integrations`, and `/settings/integrations`), not a
  Dashboard-only modal.** The mockup draws it twice: as a modal over Dashboard (T13b) and as a
  full Settings sub-page (T12f), with near-identical content. Building both would mean the same
  integration list drifting between two implementations; a normal page reachable from the sidebar
  (and reused inside Settings) matches T12f's layout and is better UX than a modal that hides the
  rest of the app.
- **Checkout totals the flat plan price, not a per-seat one.** T3b–e's plan cards are flat
  monthly fees per tier ($30/$50/$150/$250). T4's own checkout example prices a _different,
  per-seat_ "Business Plan" ($12/seat × 4 chairs) that doesn't correspond to any of those four
  tiers. Carrying the per-seat number through would silently swap out the plan the owner just
  picked, so checkout totals the selected tier's own price instead.
- **Staff Management's seat count doesn't literally match `STAFF.length`.** T12g2's "4 of 4 seats
  used, Jordan Rivera would be the 5th" is the frame that documents the seat-upgrade flow, so
  "+ New Member" always surfaces that modal first — the sample roster (6 people, including the
  owner) reflects the fuller T12g/T12h-l table content instead.

## Setup

```bash
pnpm install
pnpm dev
```

No `.env` is required to run — `VITE_API_BASE_URL` (see `.env.example`) is validated at startup
but nothing calls it yet. Other scripts: `pnpm typecheck`, `pnpm lint` / `pnpm lint:fix`,
`pnpm fmt` / `pnpm fmt:check`, `pnpm test`, `pnpm build`, `pnpm analyze`.

`pnpm prepare` (runs automatically after `pnpm install` on a git repo) wires up the same
husky + lint-staged pre-commit pattern as `bo` and the backend.

## Design system

Every color/font value in `src/styles/index.css`'s `@theme` block is lifted directly from
`Barbershop tenant webapp.dc.html` (this app's Claude Design mockup) — same `oklch()` numbers as
`bo`'s own tokens (this is the same underlying iGroom brand), registered as `tn-*` Tailwind
utilities (`bg-tn-surface`, `text-tn-gold`, ...) instead of scattered inline styles, so re-theming
means editing one file.

All ~40 frames in the mockup are built out: the full signup funnel (T1–T5), Dashboard (T6/T6b),
Calendar in all three views plus the appointment detail/reschedule/cancel modal (T7, T7c–e,
T7-week, T7-month), Waitlist in list and board view plus Add Walk-in (T8, T8b, T8c), Services plus
Add/Edit Service (T9, T9b), Staff (T10), Customers plus the Customer Journey drawer (T10c, T10d),
Payments (T11), and every Settings sub-page including the full Staff Management add-member wizard
and seat-upgrade flow (T12, T12-preview, T12b–T12l).

## Still to do

- Wire every page's sample data up to real `igroom-backend` endpoints as those endpoints get
  built — there currently aren't any for tenants/shops. Each page is structured to swap a
  `SAMPLE_*`/hardcoded array for a TanStack Query hook in place.
- A real tenant auth system on the backend (signup, login, session) — right now "signing up" only
  ever creates a `localStorage` session in this one browser.
- Real Stripe Elements/Checkout integration once there's a backend to create PaymentIntents
  against.

## Permission-driven navigation

Both navs are built from the signed-in user's `staff_permissions` keys, so nobody is shown a
link to a page they can't open. Before this, a Receptionist saw **Settings > Locations** in the
menu and got "This action requires the `locations.view` permission" on arrival — the menu was
promising something the API would refuse.

`src/auth/route-permissions.ts` is the single source of truth. `AppShell`'s root sidebar and
`SettingsLayout`'s settings sidebar filter their items through it, and `AppShell` gates the
route itself with the same map — so a hidden menu row and a blocked page can never disagree,
and typing the URL directly doesn't get you a page the menu wouldn't offer. Adding a gated
page means one entry there and a `permission` on its nav item; forget the entry and the row is
hidden but still reachable by URL, which is why the two are documented as a pair.

Each key mirrors the `requireAccountPermission(...)` guard on the endpoint the page actually
calls, so the menu tells the truth about what will work. Pages with no entry are ungated on
purpose: **Home** is the landing page everyone needs, **Business Profile**, **Security** and
**Availability** are the caller's own settings (the backend scopes them to `req.staffUser` with
no permission check), and **Integrations** has no backend yet. Waitlist, Analytics and Payments
are judgement calls rather than mirrors, because those pages still render sample data and have
no endpoint to mirror — Analytics is the shakiest, since it shows revenue while the seeded
Receptionist role is described as having "no financial access" yet holds `bookings.view`. A
dedicated `analytics.view` permission is the real fix when that page gets wired up.

Two details worth knowing:

- **This is UX, not enforcement.** Hiding a row doesn't stop a direct API call. The backend's
  `requireAccountPermission` is the boundary; this just stops the app from advertising doors it
  knows are locked.
- **Permissions are mirrored into the persisted auth store.** `usePermissions` treats the
  `/accounts/me` query as truth but writes each answer into `auth-store`, so a hard reload
  builds the right nav on the first frame instead of flashing a half-empty sidebar. `LoginPage`
  seeds them from the `getMe` it already performs, and a support session gets them back in the
  redeem response. The route guard *waits* rather than denies while nothing is cached yet — on
  a cold first load "not fetched" and "not allowed" look identical, and guessing wrong locks
  someone out of their own app.

## Support sessions

`/support-session` is where a back-office support link lands (see igroom-backend's
`modules/support-sessions`). It reads a single-use ticket from the URL **fragment**, strips
it from the address bar *before* the network call rather than after, and exchanges it for a
read-only session. With no ticket in the URL the same route doubles as the "session ended"
screen — `http.ts` sends an expired or revoked support session there instead of `/login`,
which would be a dead end for an operator who never had a password for this shop.

While such a session is active, `SupportSessionBar` shows a fixed bar with the shop name, a
countdown and an End button. That bar is **not** a notice to the shop: it renders off the
support token, which only ever exists in the tab the operator opened, so a shop owner
logging in normally never sees it. It's there so the operator can tell a support tab from a
real login at a glance, and so the first write they try reads as the rule it is rather than
as a bug in the shop's account.

Writes are refused by the API, not disabled in the UI. Graying out every mutating control
across the app would be a large, risky diff for a cosmetic gain — the bar states the
constraint, and an attempted write returns a clear 403 explaining it.
