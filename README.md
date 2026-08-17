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
- Role-aware navigation — the Add Member wizard's Role step is fully interactive, but nothing
  reads the chosen role back to gate what the _current_ signed-in user can see, the way `bo`'s
  `AppShell` does with `bo_permissions`.
