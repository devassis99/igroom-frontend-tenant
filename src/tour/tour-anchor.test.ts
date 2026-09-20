import { describe, expect, it } from "vitest";
import { cardWidth, placeCard } from "./tour-anchor";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const CARD = { width: 352, height: 220 };

/**
 * Placement is the part of a tour that goes wrong on somebody else's
 * screen. Every case below is a rectangle near an edge — the ones that
 * put a card half off a phone, or its buttons behind the tab bar.
 */
describe("placeCard", () => {
  it("centres a step that has nothing to point at", () => {
    const position = placeCard({ spotlight: null, card: CARD, viewport: DESKTOP });
    expect(position.placement).toBe("centre");
    expect(position.left).toBe((1440 - 352) / 2);
    expect(position.top).toBe((900 - 220) / 2);
  });

  it("sits under the spotlight when there is room", () => {
    const position = placeCard({
      spotlight: { top: 100, left: 600, width: 200, height: 80 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(position.placement).toBe("bottom");
    expect(position.top).toBe(100 + 80 + 14);
    // Centred on the spotlight, not on the screen.
    expect(position.left).toBe(600 + 100 - 176);
  });

  it("flips above something near the bottom of the window", () => {
    const position = placeCard({
      spotlight: { top: 780, left: 600, width: 200, height: 80 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(position.placement).toBe("top");
    expect(position.top).toBe(780 - 220 - 14);
  });

  it("goes beside a full-height element rather than on top of it", () => {
    const position = placeCard({
      spotlight: { top: 0, left: 0, width: 300, height: 900 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(position.placement).toBe("right");
    expect(position.left).toBe(300 + 14);
  });

  it("honours a step's preferred side when it fits", () => {
    const spotlight = { top: 300, left: 600, width: 200, height: 80 };
    expect(
      placeCard({ spotlight, card: CARD, viewport: DESKTOP, preferred: "top" }).placement,
    ).toBe("top");
    expect(
      placeCard({ spotlight, card: CARD, viewport: DESKTOP, preferred: "left" }).placement,
    ).toBe("left");
  });

  it("overrides a preferred side that would leave the screen", () => {
    const position = placeCard({
      spotlight: { top: 40, left: 600, width: 200, height: 80 },
      card: CARD,
      viewport: DESKTOP,
      preferred: "top",
    });
    expect(position.placement).toBe("bottom");
  });

  it("keeps the card on screen beside something at the right edge", () => {
    const position = placeCard({
      spotlight: { top: 300, left: 1380, width: 44, height: 44 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(position.left).toBeLessThanOrEqual(1440 - 352 - 14);
    expect(position.left).toBeGreaterThanOrEqual(14);
  });

  it("keeps the card inside a narrow window", () => {
    // No fixed bottom bar in this app, so the only reserved space is the
    // 14px margin — but the card still may not run off the bottom.
    const card = { width: cardWidth(PHONE.width), height: 260 };
    const position = placeCard({
      spotlight: { top: 700, left: 20, width: 350, height: 90 },
      card,
      viewport: PHONE,
    });
    expect(position.top + card.height).toBeLessThanOrEqual(844 - 14 + 0.001);
  });

  it("never hangs a side placement off a phone", () => {
    const card = { width: cardWidth(PHONE.width), height: 200 };
    const position = placeCard({
      spotlight: { top: 300, left: 16, width: 44, height: 44 },
      card,
      viewport: PHONE,
    });
    expect(["top", "bottom"]).toContain(position.placement);
    expect(position.left).toBeGreaterThanOrEqual(14);
    expect(position.left + card.width).toBeLessThanOrEqual(390 - 14 + 0.001);
  });

  it("keeps the top of the card visible when nothing fits at all", () => {
    // A spotlight filling a short window: the card has to overlap it,
    // and what must survive is the title and the buttons — the way out.
    const position = placeCard({
      spotlight: { top: 10, left: 10, width: 370, height: 300 },
      card: { width: cardWidth(PHONE.width), height: 700 },
      viewport: { width: 390, height: 420 },
    });
    expect(position.top).toBe(14);
    expect(position.left).toBe(14);
  });
});

describe("cardWidth", () => {
  it("is a fixed column on a desktop window", () => {
    expect(cardWidth(1440)).toBe(352);
  });

  it("spans a phone screen, minus the margins", () => {
    expect(cardWidth(390)).toBe(390 - 28);
  });

  it("stops growing on a tablet-width window below the breakpoint", () => {
    expect(cardWidth(620)).toBe(420);
  });
});
