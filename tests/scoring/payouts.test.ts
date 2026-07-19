import { describe, it, expect } from "vitest";
import { potFor, payoutPerWinner, round2, summarize } from "@/lib/scoring/payouts";

describe("potter och utbetalningar", () => {
  it("pott = deltagare × insats", () => {
    expect(potFor(10, 5)).toBe(50);
  });

  it("delar potten lika mellan vinnare", () => {
    // 10 personer, 5 kr insats, pott 50, två vinnare → 25 var (exemplet i specen).
    expect(payoutPerWinner(potFor(10, 5), 2)).toBe(25);
  });

  it("bevarar decimaler vid ojämn delning", () => {
    // Pott 50, tre vinnare → 16.666...
    const p = payoutPerWinner(50, 3);
    expect(p).toBeCloseTo(16.6667, 4);
    expect(round2(p)).toBe(16.67);
  });

  it("0 vinnare ger 0 utbetalning", () => {
    expect(payoutPerWinner(50, 0)).toBe(0);
  });
});

describe("summarize", () => {
  it("räknar insats, vinst och netto per deltagare", () => {
    const s = summarize(
      ["a", "b"],
      { a: 30, b: 15 },
      { a: 25, b: 50 },
    );
    expect(s).toEqual([
      { participantId: "a", totalStake: 30, totalWinnings: 25, net: -5 },
      { participantId: "b", totalStake: 15, totalWinnings: 50, net: 35 },
    ]);
  });
});
