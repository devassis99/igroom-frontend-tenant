/**
 * Every value here is the tenant mockup's own illustrative data (The
 * Gentry Barbershop, Sam Whitfield, Marcus/Devon/Ray, ...) — none of it is
 * live, since igroom-backend has no tenant/shop endpoints yet. Centralized
 * here, the same way igroom-frontend-bo's src/lib/sample-data.ts shares
 * one shop list across Overview and Shops/Accounts, so pages that show the
 * same underlying entity (e.g. Dashboard's "by location" and Settings'
 * Locations list) don't drift from each other.
 */

export interface Location {
  id: string;
  name: string;
  address: string;
  status: "Active" | "Inactive";
  staffCount: number;
  bookingsToday: number;
  revenueToday: number;
}

export const LOCATIONS: Location[] = [
  {
    id: "downtown",
    name: "The Gentry · Downtown",
    address: "412 Congress Ave, Austin, TX",
    status: "Active",
    staffCount: 4,
    bookingsToday: 14,
    revenueToday: 612,
  },
  {
    id: "north-loop",
    name: "The Gentry · North Loop",
    address: "88 Burnet Rd, Austin, TX",
    status: "Active",
    staffCount: 3,
    bookingsToday: 9,
    revenueToday: 385,
  },
];

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  location: string;
  status: "Active" | "Invited";
  initials: string;
  avatarColor: string;
  rating: number;
  bookings: number;
  hours: number;
  utilization: number;
  sales: number;
  avgTicket: number;
  commission: number;
  commissionRate: number;
}

export const STAFF: StaffMember[] = [
  {
    id: "sam",
    name: "Sam Whitfield",
    email: "sam@thegentry.com",
    role: "Owner",
    location: "All locations",
    status: "Active",
    initials: "SW",
    avatarColor: "var(--color-tn-avatar-peach)",
    rating: 5.0,
    bookings: 0,
    hours: 0,
    utilization: 0,
    sales: 0,
    avgTicket: 0,
    commission: 0,
    commissionRate: 0,
  },
  {
    id: "marcus",
    name: "Marcus Webb",
    email: "marcus@thegentry.com",
    role: "Senior Barber",
    location: "Downtown",
    status: "Active",
    initials: "MW",
    avatarColor: "var(--color-tn-avatar-brown)",
    rating: 4.9,
    bookings: 62,
    hours: 140,
    utilization: 88,
    sales: 3410,
    avgTicket: 55,
    commission: 1705,
    commissionRate: 50,
  },
  {
    id: "devon",
    name: "Devon Price",
    email: "devon@thegentry.com",
    role: "Barber",
    location: "Downtown",
    status: "Active",
    initials: "DP",
    avatarColor: "var(--color-tn-avatar-blue)",
    rating: 4.8,
    bookings: 54,
    hours: 136,
    utilization: 79,
    sales: 2565,
    avgTicket: 47.5,
    commission: 1154.25,
    commissionRate: 45,
  },
  {
    id: "ray",
    name: "Ray Ortiz",
    email: "ray@thegentry.com",
    role: "Barber",
    location: "Downtown",
    status: "Active",
    initials: "RO",
    avatarColor: "var(--color-tn-avatar-tan)",
    rating: 4.7,
    bookings: 41,
    hours: 128,
    utilization: 61,
    sales: 1845,
    avgTicket: 45,
    commission: 830.25,
    commissionRate: 45,
  },
  {
    id: "priya",
    name: "Priya Nair",
    email: "priya@thegentry.com",
    role: "Branch Manager",
    location: "North Loop",
    status: "Active",
    initials: "PN",
    avatarColor: "var(--color-tn-avatar-cream)",
    rating: 4.9,
    bookings: 0,
    hours: 0,
    utilization: 0,
    sales: 0,
    avgTicket: 0,
    commission: 0,
    commissionRate: 0,
  },
  {
    id: "lena",
    name: "Lena Ford",
    email: "lena@thegentry.com",
    role: "Receptionist",
    location: "North Loop",
    status: "Invited",
    initials: "LF",
    avatarColor: "var(--color-tn-avatar-peach)",
    rating: 0,
    bookings: 0,
    hours: 0,
    utilization: 0,
    sales: 0,
    avgTicket: 0,
    commission: 0,
    commissionRate: 0,
  },
];

export interface Service {
  id: string;
  name: string;
  duration: string;
  price: number;
  tax: string;
  category: string;
  status: "Enabled" | "Disabled";
  description?: string;
}

export const SERVICES: Service[] = [
  {
    id: "classic-haircut",
    name: "Classic Haircut",
    duration: "45 min",
    price: 45,
    tax: "Sales Tax 8.25%",
    category: "Haircuts",
    status: "Enabled",
  },
  {
    id: "kids-haircut",
    name: "Kids Haircut (12 & Under)",
    duration: "30 min",
    price: 28,
    tax: "Sales Tax 8.25%",
    category: "Haircuts",
    status: "Enabled",
  },
  {
    id: "haircut-beard-trim",
    name: "Haircut & Beard Trim",
    duration: "60 min",
    price: 65,
    tax: "Sales Tax 8.25%",
    category: "Combos",
    status: "Enabled",
  },
  {
    id: "skin-fade",
    name: "Skin Fade",
    duration: "40 min",
    price: 50,
    tax: "Sales Tax 8.25%",
    category: "Haircuts",
    status: "Enabled",
  },
  {
    id: "beard-trim",
    name: "Beard Trim",
    duration: "15 min",
    price: 20,
    tax: "—",
    category: "",
    status: "Disabled",
  },
];

// Customer type + CUSTOMERS sample list used to live here — CustomersPage
// and CustomerJourneyModal now run on real igroom-backend data instead
// (see src/lib/customers-api.ts), the same "graduate out of sample-data.ts
// once a module goes live" step Services/Staff/Locations already went
// through.

export interface Appointment {
  id: string;
  time: string;
  customer: string;
  service: string;
  barber: string;
  status: "Confirmed" | "In chair" | "Waiting";
  avatarColor: string;
}

export const TODAY_SCHEDULE: Appointment[] = [
  {
    id: "apt-1",
    time: "1:00 PM",
    customer: "Jordan Rivera",
    service: "Haircut & Beard Trim",
    barber: "Marcus",
    status: "Confirmed",
    avatarColor: "var(--color-tn-avatar-peach)",
  },
  {
    id: "apt-2",
    time: "1:45 PM",
    customer: "Alex R.",
    service: "Skin Fade",
    barber: "Devon",
    status: "In chair",
    avatarColor: "var(--color-tn-avatar-tan)",
  },
  {
    id: "apt-3",
    time: "2:30 PM",
    customer: "Sam K. (walk-in)",
    service: "Classic Haircut",
    barber: "Ray",
    status: "Waiting",
    avatarColor: "var(--color-tn-avatar-cream)",
  },
];

export interface WaitlistEntry {
  id: string;
  position: number;
  customer: string;
  service: string;
  waitingSince: string;
  preference: string;
  estimate: string;
}

export const NOW_SERVING = [
  {
    id: "serving-1",
    barber: "Marcus Webb",
    initials: "MW",
    avatarColor: "var(--color-tn-avatar-brown)",
    customer: "Alex R.",
    service: "Skin Fade",
    minutesLeft: 8,
    progressDeg: 234,
  },
  {
    id: "serving-2",
    barber: "Devon Price",
    initials: "DP",
    avatarColor: "var(--color-tn-avatar-blue)",
    customer: "Jamie L.",
    service: "Haircut & Beard Trim",
    minutesLeft: 22,
    progressDeg: 108,
  },
];

export const WAITING: WaitlistEntry[] = [
  {
    id: "wait-1",
    position: 1,
    customer: "Priya N.",
    service: "Classic Haircut",
    waitingSince: "6 min",
    preference: "Any barber",
    estimate: "~6 min",
  },
  {
    id: "wait-2",
    position: 2,
    customer: "Omar F.",
    service: "Skin Fade",
    waitingSince: "3 min",
    preference: "Prefers Devon",
    estimate: "~15 min",
  },
  {
    id: "wait-3",
    position: 3,
    customer: "Sam K.",
    service: "Classic Haircut",
    waitingSince: "1 min",
    preference: "Any barber",
    estimate: "~25 min",
  },
];

export interface Transaction {
  id: string;
  customer: string;
  date: string;
  amount: number;
}

export const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "txn-1", customer: "Jordan Rivera", date: "Aug 8", amount: 65 },
  { id: "txn-2", customer: "Alex R.", date: "Aug 8", amount: 50 },
  { id: "txn-3", customer: "Sam K.", date: "Aug 8", amount: 45 },
];

export interface Integration {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "Communication" | "Scheduling" | "Payments" | "Marketing" | "Reviews" | "Automation";
  connected: boolean;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "📅",
    description: "Sync bookings and staff schedules with Google Calendar.",
    category: "Scheduling",
    connected: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: "💬",
    description: "Send booking confirmations and reminders over WhatsApp.",
    category: "Communication",
    connected: true,
  },
  {
    id: "sms",
    name: "SMS Reminders",
    icon: "📱",
    description: "Automatic text reminders to reduce no-shows.",
    category: "Communication",
    connected: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: "💳",
    description: "Accept card payments and deposits at checkout.",
    category: "Payments",
    connected: true,
  },
  {
    id: "jazzcash",
    name: "JazzCash / Easypaisa",
    icon: "💵",
    description: "Accept mobile wallet payments for Pakistan-based shops.",
    category: "Payments",
    connected: false,
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    icon: "📊",
    description: "Sync revenue and payouts to your books automatically.",
    category: "Automation",
    connected: false,
  },
  {
    id: "google-business",
    name: "Google Business Profile",
    icon: "⭐",
    description: "Sync reviews and keep your listing hours up to date.",
    category: "Reviews",
    connected: false,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: "✉️",
    description: "Build a client email list and send promotions.",
    category: "Marketing",
    connected: false,
  },
  {
    id: "meta-pixel",
    name: "Meta Pixel",
    icon: "🎯",
    description: "Track ad performance for Instagram & Facebook campaigns.",
    category: "Marketing",
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    description: "Get new booking and waitlist alerts in your shop's Slack.",
    category: "Communication",
    connected: false,
  },
  {
    id: "zapier",
    name: "Zapier",
    icon: "⚡",
    description: "Connect iGroom to thousands of other apps and workflows.",
    category: "Automation",
    connected: false,
  },
];

/**
 * Plan/price data itself no longer lives here — ChoosePlanPage renders
 * from igroom-backend's real GET /billing/products catalog (see
 * src/lib/billing-api.ts) instead, the same one the back office's Plans
 * page manages. This type + label map are the only plan-adjacent pieces
 * still purely illustrative/UI-only: the cadence names themselves are a
 * frontend concept (mapped onto the backend's billingInterval enum in
 * billing-api.ts), not something a back-office admin configures.
 */
export type BillingCycle = "monthly" | "quarterly" | "biannual" | "annual";

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Bi-Annual",
  annual: "Annual",
};

export const WHATS_NEW = [
  {
    version: "v1.4.0",
    date: "Aug 8, 2026",
    title: "Waitlist & Seat-Based Billing",
    body: "Merge walk-ins with booked appointments in one live queue, and manage your plan by chair count.",
    latest: true,
  },
  {
    version: "v1.3.0",
    date: "Jul 22, 2026",
    title: "Deposit & partial payment checkout",
    body: "Collect a deposit at booking and charge the remaining balance after the visit.",
    latest: false,
  },
  {
    version: "v1.2.0",
    date: "Jul 3, 2026",
    title: "Barber profiles & portfolios",
    body: "Clients can now view individual barber bios, specialties and past work.",
    latest: false,
  },
];
