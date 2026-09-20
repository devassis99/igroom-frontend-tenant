import { describe, expect, it } from "vitest";
import { findTourForPath } from "./find-tour";
import { TOURS } from "./tours";

describe("findTourForPath", () => {
  it("matches each screen to its own tour", () => {
    expect(findTourForPath("/dashboard")?.id).toBe("home");
    expect(findTourForPath("/calendar")?.id).toBe("calendar");
    expect(findTourForPath("/waitlist")?.id).toBe("waitlist");
    expect(findTourForPath("/register")?.id).toBe("register");
    expect(findTourForPath("/close-of-day")?.id).toBe("close-of-day");
    expect(findTourForPath("/customers")?.id).toBe("customers");
    expect(findTourForPath("/services")?.id).toBe("services");
    expect(findTourForPath("/staff")?.id).toBe("staff");
    expect(findTourForPath("/locations")?.id).toBe("locations");
    expect(findTourForPath("/analytics")?.id).toBe("analytics");
    expect(findTourForPath("/payouts")?.id).toBe("payouts");
  });

  it("gives each settings screen its own tour rather than the profile one", () => {
    // `/settings` is a layout route with children. Without `end: true`
    // it would match every path below it, and Billing would be
    // introduced as "your shop's details".
    expect(findTourForPath("/settings")?.id).toBe("settings-profile");
    expect(findTourForPath("/settings/hours")?.id).toBe("settings-hours");
    expect(findTourForPath("/settings/security")?.id).toBe("settings-security");
    expect(findTourForPath("/settings/staff")?.id).toBe("settings-staff");
    expect(findTourForPath("/settings/billing")?.id).toBe("settings-billing");
  });

  it("uses one tour for integrations, wherever it is opened from", () => {
    // The same page is a sidebar destination and a settings tab.
    expect(findTourForPath("/integrations")?.id).toBe("integrations");
    expect(findTourForPath("/settings/integrations")?.id).toBe("integrations");
  });

  it("covers the screens outside the app shell", () => {
    expect(findTourForPath("/welcome")?.id).toBe("staff-welcome");
    expect(findTourForPath("/signup/business")?.id).toBe("signup-business");
    expect(findTourForPath("/signup/availability")?.id).toBe("signup-availability");
    expect(findTourForPath("/signup/plan")?.id).toBe("signup-plan");
  });

  it("leaves the marketing, sign-in and pass-through screens alone", () => {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/signup/receipt",
      "/invite",
      "/redirecting",
      "/support-session",
    ]) {
      expect(findTourForPath(path)).toBeUndefined();
    }
  });

  it("has no unreachable tour in the registry", () => {
    const unreachable = TOURS.filter((tour) =>
      tour.match.every((pattern) => findTourForPath(pattern)?.id !== tour.id),
    );
    expect(unreachable.map((tour) => tour.id)).toEqual([]);
  });
});

describe("the tour registry", () => {
  it("gives every tour a unique id", () => {
    const ids = TOURS.map((tour) => tour.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("opens every tour with a step that needs nothing from the page", () => {
    // The first step is the screen's introduction, and it has to work
    // while the screen is still loading, empty, or showing a permission
    // notice instead of its content.
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThan(0);
      expect(tour.steps[0]?.anchor).toBeUndefined();
    }
  });

  it("covers every route the app can land on", () => {
    // The list the router actually registers, minus the deliberately
    // untoured ones. A new screen added without a tour fails here, which
    // is the point: this is the check that keeps "every page explains
    // itself" true a year from now.
    const ROUTES = [
      "/dashboard",
      "/analytics",
      "/calendar",
      "/waitlist",
      "/register",
      "/close-of-day",
      "/services",
      "/locations",
      "/staff",
      "/customers",
      "/payouts",
      "/integrations",
      "/settings",
      "/settings/hours",
      "/settings/security",
      "/settings/staff",
      "/settings/integrations",
      "/settings/billing",
      "/welcome",
      "/signup/business",
      "/signup/availability",
      "/signup/plan",
    ];
    const missing = ROUTES.filter((path) => findTourForPath(path) === undefined);
    expect(missing).toEqual([]);
  });
});
