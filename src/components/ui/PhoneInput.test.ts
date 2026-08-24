import { describe, it, expect } from "vitest";
import {
  parsePhoneValue,
  combine,
  isPhoneValid,
  formatNational,
  digitsBeforeCaret,
  caretAfterDigit,
  type CountryDef,
} from "./PhoneInput";

/** The picker's selection, as the component holds it — only the dial code matters to combine(). */
function country(iso2: string, dialCode: string, digits: [number, number]): CountryDef {
  return { iso2, name: iso2, dialCode, digits };
}
const US = country("US", "1", [10, 10]);
const PK = country("PK", "92", [10, 10]);

describe("parsePhoneValue", () => {
  it("splits a stored international value into picker + national box", () => {
    const parsed = parsePhoneValue("+1 (343) 631-8566");
    expect(parsed.country.iso2).toBe("US");
    expect(parsed.national).toBe("(343) 631-8566");
  });

  it("resolves a shared dial code to the default country rather than whichever sorts first", () => {
    // US and Canada are both "+1". Before the tie-break, every saved US
    // number came back showing a Canadian flag.
    expect(parsePhoneValue("+1 5555550182").country.iso2).toBe("US");
  });

  it("still prefers a longer dial code over +1", () => {
    expect(parsePhoneValue("+92 3001234567").country.iso2).toBe("PK");
  });

  it("never leaves a '+' in the national box, even for an unlisted code", () => {
    expect(parsePhoneValue("+999 12345").national.startsWith("+")).toBe(false);
  });

  it("recognises a full-width plus as international", () => {
    expect(parsePhoneValue("＋1 (343) 631-8566").national).toBe("(343) 631-8566");
  });

  it("ignores an invisible bidi mark before the plus", () => {
    // Numbers copied out of contacts apps and RTL documents carry these,
    // and they used to defeat the startsWith("+") check entirely.
    expect(parsePhoneValue("‎+1 (343) 631-8566").national).toBe("(343) 631-8566");
  });

  it("treats a leading country code written without '+' as a country code", () => {
    expect(parsePhoneValue("1 (343) 631-8566").national).toBe("(343) 631-8566");
  });

  it("leaves a valid national number that merely starts with the dial digit alone", () => {
    expect(parsePhoneValue("1234567890").national).toBe("1234567890");
  });

  it("leaves an unrecognisable fragment alone rather than mangling it", () => {
    expect(parsePhoneValue("12345").national).toBe("12345");
  });

  it("returns empty for empty", () => {
    expect(parsePhoneValue("").national).toBe("");
  });
});

describe("combine", () => {
  it("joins the picker's code with the typed national number", () => {
    expect(combine(US, "(343) 631-8566")).toBe("+1 (343) 631-8566");
  });

  it("does not double the code when a complete number is pasted into the box", () => {
    expect(combine(US, "+1 (343) 631-8566")).toBe("+1 (343) 631-8566");
  });

  it("keeps only the digits when a foreign number is pasted under another code", () => {
    // The component moves the picker to match a pasted code; combine() on
    // its own just refuses to emit two codes.
    expect(combine(US, "+92 3001234567")).toBe("+1 3001234567");
  });

  it("is empty for a blank box, so an optional field round-trips as unset", () => {
    expect(combine(PK, "   ")).toBe("");
  });
});

describe("values the old parser had already written", () => {
  it("peels a doubled code instead of handing one back to the input", () => {
    const parsed = parsePhoneValue("+1 +1 (343) 631-8566");
    expect(parsed.national).toBe("(343) 631-8566");
    expect(parsed.country.iso2).toBe("US");
  });

  it("peels more than two layers", () => {
    expect(parsePhoneValue("+1 +1 +1 5555550182").national).toBe("5555550182");
  });

  it("keeps the outermost code, which is the one the picker set", () => {
    expect(parsePhoneValue("+92 +1 5555550182").country.iso2).toBe("PK");
  });

  it("re-saves a healed value stably", () => {
    const first = parsePhoneValue("+1 +1 (343) 631-8566");
    const saved = combine(first.country, first.national);
    expect(saved).toBe("+1 (343) 631-8566");

    // Second pass must be a no-op, or opening and saving an existing
    // booking would rewrite the stored number every time.
    const again = parsePhoneValue(saved);
    expect(combine(again.country, again.national)).toBe(saved);
  });
});

describe("isPhoneValid", () => {
  it("accepts a well-formed US number", () => {
    expect(isPhoneValid("+1 (343) 631-8566")).toBe(true);
  });

  it("accepts empty, since phone is optional everywhere it's used", () => {
    expect(isPhoneValid("")).toBe(true);
  });

  it("rejects a number with too many digits", () => {
    expect(isPhoneValid("+1 (343) 631-85667")).toBe(false);
  });

  it("accepts the value that produced the reported error", () => {
    // This is what the Add Booking field was holding: an 11-digit national
    // number, because the country code had leaked into the box.
    expect(isPhoneValid("+1 +1 (343) 631-8566")).toBe(true);
  });
});

describe("against the full country table", () => {
  it("does not let a longer dial code shadow a shorter one, or vice versa", () => {
    expect(parsePhoneValue("+353 851234567").country.iso2).toBe("IE");
    expect(parsePhoneValue("+972 501234567").country.iso2).toBe("IL");
    expect(parsePhoneValue("+92 3001234567").country.iso2).toBe("PK");
    expect(parsePhoneValue("+7 9161234567").country.iso2).toBe("RU");
    expect(parsePhoneValue("+971 501234567").country.iso2).toBe("AE");
    expect(parsePhoneValue("+380 671234567").country.iso2).toBe("UA");
  });

  it("never leaves a '+' in the national box for any listed country", () => {
    for (const sample of ["+1 5555550182", "+44 7700900123", "+92 3001234567", "+880 1712345678"]) {
      expect(parsePhoneValue(sample).national).not.toContain("+");
    }
  });

  it("reaches a fixed point, so re-saving never rewrites the number", () => {
    for (const dial of ["1", "44", "92", "353", "972", "7", "380", "880"]) {
      const first = parsePhoneValue(`+${dial} 5551234567`);
      const once = combine(first.country, first.national);
      const second = parsePhoneValue(once);
      expect(combine(second.country, second.national)).toBe(once);
    }
  });
});

describe("typing edge cases", () => {
  it("does not eat digits while a number is still being typed", () => {
    for (const partial of ["1", "13", "134", "1343", "1343631", "134363185"]) {
      expect(parsePhoneValue(partial).national).toBe(partial);
    }
  });

  it("strips a leading 1 only once the number is a full NANP 11 digits", () => {
    expect(parsePhoneValue("1343631856").national).toBe("1343631856");
    expect(parsePhoneValue("13436318566").national).toBe("3436318566");
    expect(parsePhoneValue("134363185667").national).toBe("134363185667");
  });

  it("leaves a variable-length country's longest form intact", () => {
    // Brazil is [10, 11]. An 11-digit Brazilian number has to survive even
    // though it is 11 digits — the in-range guard runs before the strip.
    expect(parsePhoneValue("+55 11987654321").national).toBe("11987654321");
  });
});

describe("formatNational", () => {
  it("formats a US number the way the field should show it", () => {
    expect(formatNational("US", "9954426128")).toBe("(995) 442-6128");
  });

  it("formats progressively while typing, with no dangling separator", () => {
    const seen = ["9", "99", "995", "9954", "99544", "9954426128"].map((d) =>
      formatNational("US", d),
    );
    expect(seen).toEqual(["(9", "(99", "(995", "(995) 4", "(995) 44", "(995) 442-6128"]);
  });

  it("uses each country's own grouping rather than one global one", () => {
    expect(formatNational("DZ", "551234567")).toBe("551 23 45 67");
    expect(formatNational("PK", "3001234567")).toBe("300 1234567");
    expect(formatNational("GB", "7700900123")).toBe("7700 900123");
    expect(formatNational("IN", "9812345678")).toBe("98123 45678");
    expect(formatNational("FR", "612345678")).toBe("6 12 34 56 78");
    expect(formatNational("RU", "9161234567")).toBe("916 123-45-67");
    expect(formatNational("AE", "501234567")).toBe("50 123 4567");
  });

  it("moves to the longer mask as a variable-length country grows", () => {
    expect(formatNational("BR", "1134567890")).toBe("(11) 3456-7890");
    expect(formatNational("BR", "11987654321")).toBe("(11) 98765-4321");
  });

  it("keeps digits that overflow the mask instead of eating them", () => {
    expect(formatNational("US", "99544261289")).toBe("(995) 442-61289");
  });

  it("groups sensibly for a country with no mask of its own", () => {
    expect(formatNational("ZZ", "1234567890")).toBe("123 456 7890");
  });
});

describe("caret maths", () => {
  it("counts the digits before a caret position", () => {
    expect(digitsBeforeCaret("(995) 442-6128", 6)).toBe(3);
    expect(digitsBeforeCaret("(995) 442-6128", 0)).toBe(0);
    expect(digitsBeforeCaret("(995) 442-6128", 14)).toBe(10);
  });

  it("finds the offset just after the nth digit", () => {
    expect(caretAfterDigit("(995) 442-6128", 3)).toBe(4);
    expect(caretAfterDigit("(995) 442-6128", 4)).toBe(7);
    expect(caretAfterDigit("(995) 442-6128", 0)).toBe(0);
    expect(caretAfterDigit("(995) 442-6128", 99)).toBe(14);
  });

  it("holds the caret in place when a digit is typed mid-number", () => {
    // Caret sits after "(995) 4"; the 4 digits before it must still have
    // 4 digits before them once the whole number is reformatted.
    const before = "(995) 4";
    const n = digitsBeforeCaret(before, before.length);
    expect(n).toBe(4);
    expect(caretAfterDigit(formatNational("US", "9954426128"), n)).toBe(7);
  });
});

describe("the unprefixed-code strip respects the selected country", () => {
  it("does not eat the leading 1 of an 11-digit Chinese number", () => {
    // Read against the US plan this looks like "1 + 10 digits" and loses
    // its first digit; against China's own 11-digit plan it is intact.
    const CN = { iso2: "CN", name: "China", dialCode: "86", digits: [11, 11] as [number, number] };
    expect(combine(CN, "13812345678")).toBe("+86 13812345678");
  });

  it("still strips a leading 1 from an 11-digit US number", () => {
    expect(combine(US, "13436318566")).toBe("+1 3436318566");
  });
});

describe("a stored value is a fixed point", () => {
  /**
   * Exactly what the component does on mount: parse the stored value,
   * re-lay its digits into the country mask, store it again.
   */
  function save(stored: string): string {
    const p = parsePhoneValue(stored);
    return combine(p.country, formatNational(p.country.iso2, p.national.replace(/\D/g, "")));
  }

  const samples: [string, string, string][] = [
    ["US", "1", "9954426128"],
    ["GB", "44", "7700900123"],
    ["PK", "92", "3001234567"],
    ["DZ", "213", "551234567"],
    ["FR", "33", "612345678"],
    ["RU", "7", "9161234567"],
    ["IN", "91", "9812345678"],
    ["AE", "971", "501234567"],
    ["BR", "55", "11987654321"],
    ["CN", "86", "13812345678"],
    ["UA", "380", "671234567"],
  ];

  it("does not rewrite itself on the second or third save", () => {
    // Opening a booking and saving it unchanged must not churn the number.
    for (const [iso2, dial, digits] of samples) {
      const first = `+${dial} ${formatNational(iso2, digits)}`;
      expect(save(first), `${iso2} second save`).toBe(first);
      expect(save(save(first)), `${iso2} third save`).toBe(first);
    }
  });

  it("never loses or gains a digit across a save", () => {
    for (const [iso2, dial, digits] of samples) {
      const stored = `+${dial} ${formatNational(iso2, digits)}`;
      expect(parsePhoneValue(stored).national.replace(/\D/g, ""), iso2).toBe(digits);
    }
  });
});
