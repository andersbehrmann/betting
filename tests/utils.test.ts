import { describe, it, expect } from "vitest";
import { formatKronor } from "@/lib/utils";

describe("formatKronor", () => {
  it("visar hela kronor utan decimaler", () => {
    expect(formatKronor(120)).toBe("120 kr");
  });

  it("avrundar bort ören", () => {
    expect(formatKronor(16.67)).toBe("17 kr");
    // sv-SE använder Unicode-minus (U+2212), inte bindestreck.
    expect(formatKronor(-16.67)).toBe("−17 kr");
  });

  it("visar aldrig −0 för små negativa belopp", () => {
    expect(formatKronor(-0.2)).toBe("0 kr");
  });

  it("respekterar annan valuta", () => {
    expect(formatKronor(50, "EUR")).toBe("50 EUR");
  });
});
