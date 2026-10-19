import { describe, expect, it } from "vitest";
import { LOCATION_SETUP_STEPS, setupSummary } from "./location-setup";

describe("setupSummary", () => {
  it("names one missing step on its own", () => {
    expect(setupSummary({ setupMissing: ["timezone"] })).toBe("timezone");
  });

  it("joins several in the order they're fixed", () => {
    expect(setupSummary({ setupMissing: ["hours", "timezone", "services"] })).toBe(
      "timezone, services and working hours",
    );
  });

  it("is empty for a branch that's ready", () => {
    expect(setupSummary({ setupMissing: [] })).toBe("");
  });

  it("has guidance for every step the backend can report", () => {
    expect(LOCATION_SETUP_STEPS.map((s) => s.step)).toEqual([
      "timezone",
      "services",
      "staff",
      "hours",
    ]);
  });
});
