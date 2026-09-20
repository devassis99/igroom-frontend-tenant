# In-app tours

The walkthrough somebody sees the first time they open a screen: the page dims,
one thing is lit up, and a card next to it says what that thing is for. Skip,
Back, Next, a step counter, and the occasional pro tip.

It is this app's user-facing documentation, and it lives next to the app so it
can't drift from it. The customer app (`igroom-frontend-marketplace-app`) has
the same system with its own content — the engine files are deliberately near
enough to diff.

## How it runs

`<TourProvider />` is mounted once per shell — `AppShell` for everything behind
the sidebar, and the staff welcome and signup screens that sit outside it. On
every navigation it looks up the current path in `tours.ts`, and if that screen
has a tour this browser hasn't seen, it opens it about a second later, once the
page's own data has landed.

A tour ends when somebody finishes it, skips it, presses Escape, or clicks the
dimmed area, and any of those mean "don't show me this again". Navigating away
mid-tour does **not**: the tour closes unseen and waits for the next visit.

What the browser remembers (`localStorage`, `igroom.tenant.tours.v1`) is which
tours have been seen and whether tips are switched on. It is per-browser, not
per-account — worth knowing on a shared front-desk machine, and said out loud on
the settings card. Which tour is open and which step it is on is never
persisted: a tour restored on the next page load would appear over a screen
somebody navigated to deliberately.

## The help button

`TourLauncher` (mounted by `TourProvider`, so it is on every screen that has a
guide) is the round button in the bottom-right corner. Opening it gives:

- **Show me around this page** — replays this screen's walkthrough.
- **Search** — across every step of every tour, title matches first. Picking a
  result on another screen navigates there and starts that screen's walkthrough
  at the right step (`requestTour` parks the request; the provider picks it up
  once the new screen has mounted).
- **On this page / Other screens** — the same content as a list, for reading
  rather than being shown.
- A footer switch for whether tips open by themselves.

It stays mounted while a tour runs — the Home tour's last step points at it —
but the panel can't be opened over a running tour.

Anything else `position: fixed` in the bottom-right corner has to stay clear of
it; the calendar's scroll-right affordance is offset for exactly that reason.

## Adding a tour to a screen

1. **Write the steps** in `tours.ts`:

   ```ts
   {
     id: "reports",
     version: 1,
     title: "Reports",
     match: ["/reports"],
     steps: [
       { title: "Your reports", body: "Everything the shop did last month, in one place." },
       {
         anchor: "reports-range",
         title: "Pick a period",
         body: "Comparisons are against the same length of time before it.",
         tip: "Exports carry whatever range is selected here.",
       },
     ],
   }
   ```

2. **Anchor the elements** the steps point at:

   ```tsx
   <div data-tour="reports-range">…</div>
   ```

That is the whole integration. The page imports nothing.

`find-tour.test.ts` has a list of every route the app registers and asserts each
one resolves to a tour. A new screen with no tour fails that test — which is the
point.

## Things worth knowing

- **Every tour opens with an unanchored step** that says what the screen is for.
  It works while the page is loading, empty, or showing a permission notice —
  which is when somebody most needs to be told where they are.
- **Anchoring something conditional is safe.** A step whose element never
  appears falls back to a centred card after a couple of seconds. But a step
  _about_ something only some accounts have (a second branch, a loyalty
  program) should read as though the reader might not be looking at one.
- **The same anchor can go on several elements** — the register's ticket panel
  has three states with three roots, the calendar draws a different grid per
  view. Only one is ever laid out, and the overlay picks whichever is visible.
- **`end: true` matching** means `/settings` and `/settings/billing` are
  separate screens with separate tours. Keep it that way.
- **Bump `version`** when the steps change materially: everybody who has seen
  the tour gets it once more. Leave it alone for a typo.
- **Radius and padding follow the thing underneath.** `radius: 999` for a
  circular control, `8`–`10` for a row or a tab strip, the default `16` for a
  card.
- **Permissions take care of themselves.** Tours are matched per route, and a
  role that can't reach `/register` never gets the register's tour.
