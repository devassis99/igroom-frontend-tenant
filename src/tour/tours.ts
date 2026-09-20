import type { Tour } from "./types";

/**
 * Every tour in the tenant app, as content.
 *
 * This file is what the product says about itself to the person running
 * a shop with it: what a screen is for, and the one or two things about
 * it that are not obvious from looking. It is plain data — no
 * components, no conditionals — so improving an explanation is a copy
 * edit rather than a code change, and so the whole of it can be read top
 * to bottom in one sitting.
 *
 * Three rules hold it together:
 *
 *  1. **Every screen opens with a step that has no anchor.** That step
 *     introduces the screen in one sentence, and because it needs
 *     nothing from the DOM it still works while the page is loading,
 *     empty, or showing a permission notice — which is exactly when
 *     somebody most needs telling where they are.
 *  2. **Anchored steps are a bonus, never a requirement.** A shop with
 *     one branch has no location filter; a new account has no staff
 *     table. Those steps fall back to a centred card rather than
 *     breaking the tour.
 *  3. **Write for the person actually on that screen.** The register
 *     and the waitlist are read by a front desk mid-shift; Billing and
 *     Analytics are read by an owner on a Sunday. Same system, different
 *     register of voice.
 *
 * Bump a tour's `version` when the steps change materially: everybody
 * who has already seen it gets it once more. Leave it alone for a typo.
 *
 * Two anchors belong to the shell rather than to any page: `app-nav`
 * (the sidebar's rows) and `nav-help` (the button that reopens all of
 * this). Both are only used by the Home tour, which is the one tour
 * that has to explain the app rather than a screen.
 */
export const TOURS: readonly Tour[] = [
  {
    id: "home",
    version: 1,
    title: "Getting started",
    match: ["/dashboard"],
    steps: [
      {
        title: "Welcome to iGroom",
        body: "This is the shop's control room: the diary, the walk-in queue, the till, your team and your takings. Here's the thirty-second version.",
      },
      {
        anchor: "app-nav",
        title: "Everything, in the order a day runs",
        body: "The top band is your shift — calendar, waitlist, register, close of day. Below it, the business: customers, analytics, payouts. At the bottom, the things you set up once.",
        placement: "right",
        radius: 10,
        tip: "The arrow by the iGroom logo collapses this to icons when you want the screen back.",
      },
      {
        anchor: "home-checklist",
        title: "Finish setting up",
        body: "Each item here is something a customer can't do until it's done — a menu to book from, hours to book into, a way to get paid. It ticks itself off as you go.",
      },
      {
        anchor: "home-resources",
        title: "Help, when you want a person",
        body: "Guides for the parts that take a minute to learn, and a way to reach us when something isn't behaving.",
      },
      {
        anchor: "nav-help",
        title: "Help lives in the corner",
        body: 'Every screen has a short walkthrough, shown the first time you open it. This button replays the one you\'re on — and searches all the others, so "how do I split tips" finds the right screen from anywhere.',
        placement: "left",
        radius: 999,
        padding: 8,
      },
    ],
  },

  {
    id: "calendar",
    version: 1,
    title: "The calendar",
    match: ["/calendar"],
    steps: [
      {
        title: "The diary",
        body: "Every booking in the shop, by barber and by day. This is the screen a front desk keeps open all day, and the one customers' online bookings land in as they come.",
      },
      {
        anchor: "calendar-toolbar",
        title: "Day, week, month, list",
        body: "Day is the working view — one column per barber. Week is for spotting gaps, month for planning, list for reading everything without the grid.",
        tip: '"+ Add Booking" takes a walk-in or a phone booking; it checks the same availability a customer would see, so it can\'t double-book a chair.',
      },
      {
        anchor: "calendar-staff-filter",
        title: "Who's in view",
        body: 'Pick the barbers you want to see. Save a group as a set — "Saturday team", "the upstairs chairs" — and switch to it in one tap.',
        tip: "A barber greyed out here is off rota that day. Booking them anyway is possible, and the slot is marked as outside their shift.",
      },
      {
        anchor: "calendar-grid",
        title: "The grid itself",
        body: "Tap any booking to open it: reschedule, mark arrived, or take payment. Tap an empty slot to book straight into it.",
        tip: "The line across the grid is now. It follows the shop's own clock, not your computer's, so a branch in another timezone reads correctly.",
      },
      {
        anchor: "calendar-location",
        title: "One branch at a time",
        body: "Shops with more than one location pick the branch here. The calendar, the staff list and the availability all follow it.",
      },
    ],
  },

  {
    id: "waitlist",
    version: 1,
    title: "The walk-in queue",
    match: ["/waitlist"],
    steps: [
      {
        title: "Today's walk-ins",
        body: "Everybody waiting, in order, with how long they've been there. It updates on its own — leave it open on the front desk and it stays current.",
      },
      {
        anchor: "waitlist-add",
        title: "Add somebody at the desk",
        body: "Name, what they're after, and who they'll take. They get a place in the line and a text when their chair is close.",
        tip: "Customers can add themselves from the QR code on your Locations page. Both land in the same queue.",
      },
      {
        anchor: "waitlist-toolbar",
        title: "List or board",
        body: "List is the queue in order — fastest to read mid-shift. Board shows it by barber, which is what you want when you're deciding who takes the next one.",
      },
      {
        anchor: "waitlist-board",
        title: "Seat, complete, no-show",
        body: "Seating somebody moves them into the chair and starts their ticket. No-show frees the slot and keeps the record, so your wait estimates stay honest.",
      },
    ],
  },

  {
    id: "register",
    version: 1,
    title: "The register",
    match: ["/register"],
    steps: [
      {
        title: "Taking the money",
        body: "Today's appointments on the left, the open ticket on the right. Tap a customer, add anything extra, take the payment.",
      },
      {
        anchor: "register-queue",
        title: "Today, in order",
        body: "Everyone booked or seated today. A greyed-out row is one that can't be charged yet — the reason is printed underneath it.",
      },
      {
        anchor: "register-ticket",
        title: "The open ticket",
        body: "Services, products, discount and tip, then the payment. Card or cash, split across both if that's what's happening.",
        tip: "The tip splits by the rule set in Close of day, so nobody has to do arithmetic at the counter.",
      },
      {
        anchor: "register-counter-sale",
        title: "A sale with no appointment",
        body: "Somebody buying a bottle of something on their way past. Opens an empty ticket that works exactly like the others.",
      },
    ],
  },

  {
    id: "close-of-day",
    version: 1,
    title: "Closing up",
    match: ["/close-of-day"],
    steps: [
      {
        title: "The end of the night",
        body: "What came in today, who is owed what out of it, and the drawer count that closes the day.",
      },
      {
        anchor: "close-stats",
        title: "The day in three numbers",
        body: "Tickets rung up, money taken, tips collected. These are the day's own totals — they stop moving once the day is closed.",
      },
      {
        anchor: "close-tip-rule",
        title: "How tips are shared",
        body: "Set it once and every ticket follows it: straight to the barber, or pooled and split. Changing the rule affects tickets from here on, not the ones already rung up.",
      },
      {
        anchor: "close-finish",
        title: "Count and close",
        body: "Enter what's actually in the drawer, and iGroom records the difference against what it expected. Closing locks the day — a correction after that is a new ticket, not an edit.",
        tip: "Do this before you lock up. A day left open keeps collecting tomorrow's takings.",
      },
    ],
  },

  {
    id: "customers",
    version: 1,
    title: "Customers",
    match: ["/customers"],
    steps: [
      {
        title: "Everyone who has been in",
        body: "Built from your bookings rather than typed up: anybody who books, walks in, or is added at the desk shows up here with their history.",
      },
      {
        anchor: "customers-search",
        title: "Find somebody fast",
        body: "Name, phone or email. The chips beside it narrow to your regulars, this month's new faces, or the ones you haven't seen in three months.",
        tip: '"Inactive 90d+" is the list worth exporting before a quiet week.',
      },
      {
        anchor: "customers-stats",
        title: "How the book is doing",
        body: "Repeat rate is the number to watch — it says whether the people coming in are coming back, which no amount of new bookings makes up for.",
      },
      {
        anchor: "customers-add",
        title: "Add one by hand",
        body: "For the customer who only ever phones. Once they're here, the desk can book them without taking their details again.",
      },
    ],
  },

  {
    id: "services",
    version: 1,
    title: "Your menu",
    match: ["/services"],
    steps: [
      {
        title: "What you sell",
        body: "Every service, with its price and how long the chair is needed. This is what customers book from, and what the calendar uses to size a slot.",
      },
      {
        anchor: "services-add",
        title: "Add a service",
        body: "Name, price, duration, and which branches offer it. The duration is the one people underestimate — it's what stops the day running late.",
      },
      {
        anchor: "services-tools",
        title: "Categories and order",
        body: "Categories group the menu for customers. The order here is the order they see, so the things you want booked go at the top.",
        tip: "Export to CSV gives you the whole menu as a spreadsheet — useful for a price review, or for a printed list on the wall.",
      },
      {
        anchor: "services-search",
        title: "Find one quickly",
        body: "Once a menu passes about twenty services, this is faster than scrolling.",
      },
    ],
  },

  {
    id: "staff",
    version: 1,
    title: "Your team",
    match: ["/staff"],
    steps: [
      {
        title: "Who works here",
        body: "Your barbers and stylists, and how each of them is doing: what they've sold, their average ticket, how full their chair is.",
      },
      {
        anchor: "staff-add",
        title: "Add someone",
        body: "They get an email invite, set their own password, and land on a short setup for their hours. Nothing to hand out but the invite.",
      },
      {
        anchor: "staff-stats",
        title: "The team at a glance",
        body: "Utilization is chair time booked against chair time available. It's the number that says whether you need another pair of hands or just more bookings.",
      },
      {
        anchor: "staff-table",
        title: "Per person",
        body: "The same figures per barber, plus their commission. Open anyone to change their services, rota or pay.",
      },
    ],
  },

  {
    id: "locations",
    version: 1,
    title: "Your branches",
    match: ["/locations"],
    steps: [
      {
        title: "Your branches",
        body: "Each one has its own address, hours, team, menu and payouts. Pick a branch on the left and everything to the right belongs to it.",
      },
      {
        anchor: "locations-add",
        title: "Add a branch",
        body: "A new site takes a seat on your plan. Its hours, staff and menu are set from the tabs once it exists.",
      },
      {
        anchor: "locations-list",
        title: "Switching between them",
        body: "The list is filtered by the box above it, which earns its place around the point a chain passes five sites.",
        tip: "Each branch has its own QR code for the walk-in queue — print it and put it by the door.",
      },
    ],
  },

  {
    id: "analytics",
    version: 1,
    title: "Analytics",
    match: ["/analytics"],
    steps: [
      {
        title: "How today is going",
        body: "Bookings, waiting, revenue and rating — plus today's schedule and the same figures branch by branch.",
      },
      {
        anchor: "analytics-stats",
        title: "Today in four numbers",
        body: "The ones worth a glance between clients. Everything below breaks them down.",
      },
      {
        anchor: "analytics-schedule",
        title: "Today's schedule",
        body: "A read-only version of the diary for when you just want to see what's coming rather than change it.",
      },
      {
        anchor: "analytics-locations",
        title: "Branch by branch",
        body: "Where the day's bookings and money are actually happening — the comparison that tells you which site needs attention.",
      },
    ],
  },

  {
    id: "payouts",
    version: 1,
    title: "Payouts",
    match: ["/payouts"],
    steps: [
      {
        title: "Money coming to you",
        body: "What you've taken, what is still on its way, and the account it lands in. This is money in — your own subscription lives in Settings, under Billing.",
      },
      {
        anchor: "payouts-stats",
        title: "Taken, pending, where it lands",
        body: "Card payments settle on a delay, so \"pending\" is normal — it's today's takings on their way to the bank.",
      },
      {
        anchor: "payouts-transactions",
        title: "Recent transactions",
        body: "Line by line, so a figure that looks wrong can be traced back to the ticket it came from.",
      },
    ],
  },

  {
    id: "integrations",
    version: 1,
    title: "Integrations",
    match: ["/integrations", "/settings/integrations"],
    steps: [
      {
        title: "Everything else you run on",
        body: "Payments, messaging, accounting, marketing. Connect one and iGroom keeps it fed rather than asking you to copy things between two systems.",
      },
      {
        anchor: "integrations-categories",
        title: "By what it does",
        body: 'Browse by category rather than by brand — the question is usually "how do I text customers", not "is X supported".',
        placement: "right",
      },
      {
        anchor: "integrations-search",
        title: "Or search for it by name",
        body: "If you already use something, look for it here before setting up anything new.",
      },
    ],
  },

  {
    id: "settings-profile",
    version: 1,
    title: "Profile settings",
    match: ["/settings"],
    steps: [
      {
        title: "Your shop's details",
        body: "The name, contact details and photos customers see, plus the account settings behind them.",
      },
      {
        anchor: "settings-nav",
        title: "Everything under settings",
        body: "Profile, availability, security, your team's roles, integrations and billing. Each is its own screen with its own tips.",
        placement: "right",
      },
      {
        anchor: "settings-public-profile",
        title: "What customers see",
        body: "Photos, description and the details on your public page. Preview as Customer shows it exactly as it appears in the customer app.",
        tip: "Shops with real photos of the room get noticeably more bookings than ones with none. It's the cheapest change on this page.",
      },
      {
        anchor: "settings-tips",
        title: "These walkthroughs",
        body: "Every screen has one, shown the first time you open it. Replay them all from here, or switch them off for everyone who uses this browser.",
        tip: "Switching them off doesn't remove them — the help button in the bottom-right corner always brings the current screen's tips back.",
      },
    ],
  },

  {
    id: "settings-hours",
    version: 1,
    title: "Availability",
    match: ["/settings/hours"],
    steps: [
      {
        title: "When people can be booked",
        body: "Each person's working week, plus the days that don't follow it — holidays, a late start, a Saturday off. This is what decides the slots a customer sees.",
      },
      {
        anchor: "hours-controls",
        title: "Whose week you're editing",
        body: "Pick the person, and the branch if you run more than one. Travel buffer is the gap iGroom leaves when somebody works at two sites in a day.",
      },
      {
        anchor: "hours-editor",
        title: "The week itself",
        body: "Set the hours per day, copy one day across the others, and add an override for anything that's a one-off.",
        tip: "A clash warning here is worth reading rather than dismissing — it means a booking already exists in the hours you're removing.",
      },
    ],
  },

  {
    id: "settings-security",
    version: 1,
    title: "Security",
    match: ["/settings/security"],
    steps: [
      {
        title: "Getting in, and staying safe",
        body: "Your password, two-factor, and everywhere you're currently signed in.",
      },
      {
        anchor: "security-rows",
        title: "Worth ten minutes",
        body: "This account can move money and read every customer's details. Two-factor is the single change that protects both.",
        tip: "Active sessions is where to look if a device was lost — signing it out here ends its access immediately.",
      },
    ],
  },

  {
    id: "settings-staff",
    version: 1,
    title: "Staff management",
    match: ["/settings/staff"],
    steps: [
      {
        title: "Who can do what",
        body: "Your team's accounts and the roles that decide what each of them can see. This is the access side of staff; their hours and pay live on the Staff screen.",
      },
      {
        anchor: "staff-mgmt-tabs",
        title: "Members and roles",
        body: "Members are people. Roles are the sets of permissions you give them — change a role and everybody on it changes with it.",
      },
      {
        anchor: "staff-mgmt-add",
        title: "Adding someone",
        body: "Invite them by email and pick a role. Give the smallest role that lets them do their job — a front desk rarely needs to see payouts.",
      },
    ],
  },

  {
    id: "settings-billing",
    version: 1,
    title: "Billing & plan",
    match: ["/settings/billing"],
    steps: [
      {
        title: "Your subscription",
        body: "What you pay iGroom, the card it comes off, and every invoice so far. Money coming *to* you is on the Payouts screen instead.",
      },
      {
        anchor: "billing-plan",
        title: "Your plan and seats",
        body: "Seats are counted per location. Adding a branch takes one; closing a branch gives it back at the next renewal.",
      },
      {
        anchor: "billing-payment-method",
        title: "The card on file",
        body: "Kept by our payment provider, never by iGroom — we only ever see the last four digits.",
        tip: "Keep a second card here if you can. A single expired card is the most common reason an account lapses.",
      },
    ],
  },

  {
    id: "staff-welcome",
    version: 1,
    title: "Setting up your account",
    match: ["/welcome"],
    steps: [
      {
        title: "Welcome to the team",
        body: "Two things before you start: a password of your own, and the hours you work. Both take a minute, and the shop's calendar can't book you until the hours are in.",
      },
    ],
  },

  {
    id: "signup-business",
    version: 1,
    title: "Your business details",
    match: ["/signup/business"],
    steps: [
      {
        title: "Tell us about the shop",
        body: "The name and address customers will see. You can change all of it later — nothing here is locked in by finishing the signup.",
      },
    ],
  },

  {
    id: "signup-availability",
    version: 1,
    title: "Your opening hours",
    match: ["/signup/availability"],
    steps: [
      {
        title: "When you're open",
        body: "Asked before payment on purpose: your account is created with a working calendar already in it, so the first thing you see after signing up is a diary that can take a booking.",
      },
    ],
  },

  {
    id: "signup-plan",
    version: 1,
    title: "Choosing a plan",
    match: ["/signup/plan"],
    steps: [
      {
        title: "Pick a plan",
        body: "Priced per location rather than per booking, so a busy month costs the same as a quiet one. Payment is handled by Stripe on their own page.",
      },
    ],
  },
] as const;

export const TOURS_BY_ID: ReadonlyMap<string, Tour> = new Map(
  TOURS.map((tour) => [tour.id, tour] as const),
);
