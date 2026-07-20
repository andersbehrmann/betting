import { describe, it, expect } from "vitest";
import { distributeUnwonPots, type UnwonGame } from "@/lib/scoring/unwon";

const game = (gameId: string, stakes: [string, number][]): UnwonGame => ({
  gameId,
  stakes: stakes.map(([participantId, stake]) => ({ participantId, stake })),
});

const sum = (credits: Record<string, number>) =>
  Math.round(Object.values(credits).reduce((s, v) => s + v, 0) * 100) / 100;

describe("distributeUnwonPots", () => {
  it("inga oavgjorda spel ger inga krediteringar", () => {
    const d = distributeUnwonPots([], ["a"], "refund");
    expect(d.credits).toEqual({});
    expect(d.totalUnwon).toBe(0);
  });

  it("refund: var och en får tillbaka exakt sin egen insats", () => {
    const d = distributeUnwonPots(
      [game("g1", [["a", 5], ["b", 5], ["c", 5]])],
      ["a"],
      "refund",
    );
    expect(d.credits).toEqual({ a: 5, b: 5, c: 5 });
    expect(d.refunded).toBe(15);
    expect(d.rolledOver).toBe(0);
  });

  it("refund: insatser summeras över flera oavgjorda spel", () => {
    const d = distributeUnwonPots(
      [game("g1", [["a", 5], ["b", 5]]), game("g2", [["a", 10]])],
      [],
      "refund",
    );
    expect(d.credits).toEqual({ a: 15, b: 5 });
    expect(d.totalUnwon).toBe(20);
  });

  it("jackpot: hela beloppet delas lika mellan jackpotvinnarna", () => {
    const d = distributeUnwonPots(
      [game("g1", [["a", 5], ["b", 5], ["c", 5], ["d", 5]])],
      ["a", "b"],
      "jackpot",
    );
    expect(d.credits).toEqual({ a: 10, b: 10 });
    expect(d.rolledOver).toBe(20);
    expect(d.refunded).toBe(0);
    expect(d.fellBackToRefund).toBe(false);
  });

  it("jackpot utan jackpotvinnare faller tillbaka på återbetalning", () => {
    const d = distributeUnwonPots([game("g1", [["a", 5], ["b", 5]])], [], "jackpot");
    expect(d.credits).toEqual({ a: 5, b: 5 });
    expect(d.refunded).toBe(10);
    expect(d.rolledOver).toBe(0);
    expect(d.fellBackToRefund).toBe(true);
  });

  it("pengarna försvinner aldrig: summan av krediteringar = totalUnwon", () => {
    const cases: [UnwonGame[], string[], "refund" | "jackpot"][] = [
      [[game("g1", [["a", 5], ["b", 5], ["c", 5]])], ["x", "y", "z"], "jackpot"],
      [[game("g1", [["a", 5], ["b", 5], ["c", 5]])], ["x"], "jackpot"],
      [[game("g1", [["a", 5], ["b", 5], ["c", 5]])], [], "jackpot"],
      [[game("g1", [["a", 5], ["b", 5], ["c", 5]])], ["x", "y"], "refund"],
      [[game("g1", [["a", 2.5]]), game("g2", [["b", 7.5], ["c", 5]])], ["x", "y", "z"], "jackpot"],
    ];
    for (const [games, winners, policy] of cases) {
      const d = distributeUnwonPots(games, winners, policy);
      expect(sum(d.credits)).toBe(d.totalUnwon);
      expect(d.rolledOver + d.refunded).toBe(d.totalUnwon);
    }
  });

  it("udda delning lämnar inga ören på golvet (25 kr på 3 vinnare)", () => {
    const d = distributeUnwonPots(
      [game("g1", [["a", 5], ["b", 5], ["c", 5], ["d", 5], ["e", 5]])],
      ["x", "y", "z"],
      "jackpot",
    );
    expect(sum(d.credits)).toBe(25);
  });

  it("VM-finalen 2026: 75 kr i tre oavgjorda spel återbetalas till dem som satsat", () => {
    // Första målskytt, Tid för första målet, Totalt antal gula kort – 5 spelare à 5 kr.
    const players = ["sara", "daniel", "jloo", "annors", "kevin"];
    const games = ["first_scorer", "first_goal_time", "total_yellows"].map((g) =>
      game(g, players.map((p) => [p, 5] as [string, number])),
    );
    const d = distributeUnwonPots(games, ["daniel"], "refund");
    expect(d.totalUnwon).toBe(75);
    for (const p of players) expect(d.credits[p]).toBe(15);
    expect(sum(d.credits)).toBe(75);
  });
});
