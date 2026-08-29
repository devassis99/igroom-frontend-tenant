import { describe, it, expect } from "vitest";
import {
  convertRange,
  fromMinutes,
  rangesOverlap,
  to12Hour,
  toMinutes,
  utcOffsetLabel,
  zoneOffsetMinutes,
} from "./timezones";

/**
 * The cross-shop note in the availability editor is the only thing in
 * the app that reads one shop's wall clock in another's, and it is the
 * whole reason a member can now hold hours in two timezones at once. If
 * these conversions are an hour out, the note quietly tells an owner
 * that a clash isn't one.
 */

describe("zoneOffsetMinutes", () => {
  it("reads a whole-hour zone", () => {
    // Karachi is UTC+5 year round — no DST to make this date-dependent.
    expect(zoneOffsetMinutes("Asia/Karachi", new Date("2026-08-24T12:00:00Z"))).toBe(300);
  });

  it("reads a half-hour zone, which a naive hours-only parse would round away", () => {
    expect(zoneOffsetMinutes("Asia/Kolkata", new Date("2026-08-24T12:00:00Z"))).toBe(330);
  });

  it("reads a zone west of UTC as negative", () => {
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z"))).toBe(-300);
  });

  it("follows the same zone across a DST boundary rather than assuming one offset", () => {
    const winter = zoneOffsetMinutes("Europe/London", new Date("2026-01-15T12:00:00Z"));
    const summer = zoneOffsetMinutes("Europe/London", new Date("2026-07-15T12:00:00Z"));
    expect(winter).toBe(0);
    expect(summer).toBe(60);
  });

  it("treats an unset or unusable zone as UTC, matching the backend's resolveTimeZone", () => {
    expect(zoneOffsetMinutes(null)).toBe(0);
    expect(zoneOffsetMinutes("PKT")).toBe(0);
    expect(zoneOffsetMinutes("not a zone")).toBe(0);
  });
});

/**
 * Offsets move with the calendar — London is UTC+0 in January and UTC+1
 * in July — so every conversion below is pinned to a fixed instant.
 * Without it these assertions would pass for half the year.
 */
const IN_SUMMER = new Date("2026-09-02T12:00:00Z");
const IN_WINTER = new Date("2026-01-14T12:00:00Z");

describe("convertRange", () => {
  it("reads Soho's Wednesday on Valencia's clock — the mockup's own example", () => {
    // Wed 10:00-18:00 in London is 14:00-22:00 in Karachi, which is why
    // Valencia can't have her Wednesday afternoon.
    const converted = convertRange(
      { startTime: "10:00", endTime: "18:00" },
      3,
      "Europe/London",
      "Asia/Karachi",
      IN_SUMMER,
    );
    expect(converted.startTime).toBe("14:00");
    expect(converted.endTime).toBe("22:00");
    expect(converted.dayShift).toBe(0);
  });

  it("is the identity when both shops keep the same clock", () => {
    const converted = convertRange(
      { startTime: "09:00", endTime: "17:00" },
      1,
      "Asia/Karachi",
      "Asia/Karachi",
      IN_SUMMER,
    );
    expect(converted).toMatchObject({ startTime: "09:00", endTime: "17:00", dayShift: 0 });
  });

  it("wraps a range pushed past midnight onto the next day instead of printing 26:00", () => {
    // 21:00-23:00 in Karachi is the small hours of the following morning
    // in Sydney. Losing the day would show an owner a range that appears to
    // sit inside the same Monday it doesn't.
    const converted = convertRange(
      { startTime: "21:00", endTime: "23:00" },
      1,
      "Asia/Karachi",
      "Australia/Sydney",
      IN_SUMMER,
    );
    // Sydney is UTC+10 that week, Karachi UTC+5.
    expect(converted.startTime).toBe("02:00");
    expect(converted.endTime).toBe("04:00");
    expect(converted.dayShift).toBe(1);
  });

  it("wraps backwards too, for a shop far enough west", () => {
    const converted = convertRange(
      { startTime: "02:00", endTime: "06:00" },
      3,
      "Asia/Karachi",
      "America/Los_Angeles",
      IN_WINTER,
    );
    expect(converted.dayShift).toBe(-1);
  });

  it("carries a half-hour offset through rather than rounding to the hour", () => {
    const converted = convertRange(
      { startTime: "09:00", endTime: "17:00" },
      2,
      "Asia/Karachi",
      "Asia/Kolkata",
      IN_SUMMER,
    );
    expect(converted.startTime).toBe("09:30");
    expect(converted.endTime).toBe("17:30");
  });
});

describe("rangesOverlap", () => {
  it("catches a genuine collision", () => {
    expect(
      rangesOverlap(
        { startTime: "14:00", endTime: "19:00" },
        { startTime: "14:00", endTime: "22:00" },
      ),
    ).toBe(true);
  });

  it("does not treat back-to-back shifts at two shops as a collision", () => {
    // Unlike the within-one-shop rule, finishing at Soho exactly as
    // Valencia opens is only a problem if you also have to travel —
    // which this can't know, so it doesn't claim to.
    expect(
      rangesOverlap(
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "17:00" },
      ),
    ).toBe(false);
  });

  it("leaves a clear gap alone", () => {
    expect(
      rangesOverlap(
        { startTime: "09:00", endTime: "11:00" },
        { startTime: "14:00", endTime: "17:00" },
      ),
    ).toBe(false);
  });
});

describe("time string helpers", () => {
  it("round-trips a time through minutes", () => {
    expect(fromMinutes(toMinutes("09:30"))).toBe("09:30");
    expect(fromMinutes(toMinutes("00:00"))).toBe("00:00");
    expect(fromMinutes(toMinutes("23:45"))).toBe("23:45");
  });

  it("wraps rather than overflowing past a day", () => {
    expect(fromMinutes(25 * 60)).toBe("01:00");
    expect(fromMinutes(-60)).toBe("23:00");
  });

  it("says noon and midnight as people do, not as 0:00 PM", () => {
    expect(to12Hour("00:00")).toBe("12:00 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("14:00")).toBe("2:00 PM");
    expect(to12Hour("22:00")).toBe("10:00 PM");
  });
});

describe("utcOffsetLabel", () => {
  it("labels the shop tabs in the UTC±n form the mockup uses", () => {
    expect(utcOffsetLabel("Asia/Karachi")).toBe("UTC+5");
    expect(utcOffsetLabel(null)).toBe("UTC");
  });
});
