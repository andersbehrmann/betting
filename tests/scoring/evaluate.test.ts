import { describe, it, expect } from "vitest";
import {
  isCorrect,
  computeGameWinners,
  computePackagePoints,
  computePackageWinners,
  assemblePackageResult,
  type BetLike,
  type PackageBet,
} from "@/lib/scoring/evaluate";

describe("isCorrect – enkla optionsspel", () => {
  it("matchar rätt val", () => {
    expect(isCorrect("world_champion", { value: "team_one" }, { value: "team_one" })).toBe(true);
    expect(isCorrect("world_champion", { value: "team_two" }, { value: "team_one" })).toBe(false);
  });

  it("returnerar false när facit saknas", () => {
    expect(isCorrect("extra_time", { value: "yes" }, null as never)).toBe(false);
  });

  it("hanterar first_scorer via värde (spelare/självmål/ingen)", () => {
    expect(isCorrect("first_scorer", { value: "p1" }, { value: "p1" })).toBe(true);
    expect(isCorrect("first_scorer", { value: "own_goal" }, { value: "none" })).toBe(false);
  });
});

describe("computeGameWinners – result_90 exakt", () => {
  const bets: BetLike[] = [
    { participantId: "a", answer: { home: 2, away: 1 } },
    { participantId: "b", answer: { home: 2, away: 1 } },
    { participantId: "c", answer: { home: 0, away: 0 } },
  ];

  it("exakt rätt vinner och kan delas", () => {
    const r = computeGameWinners("result_90", bets, { home: 2, away: 1 });
    expect(r.mode).toBe("exact");
    expect(r.winnerIds.sort()).toEqual(["a", "b"]);
  });
});

describe("computeGameWinners – result_90 närmast", () => {
  it("no_winner-läge ger ingen vinnare när ingen har exakt", () => {
    const bets: BetLike[] = [
      { participantId: "a", answer: { home: 3, away: 0 } },
      { participantId: "b", answer: { home: 1, away: 2 } },
    ];
    const r = computeGameWinners("result_90", bets, { home: 2, away: 2 }, { closestMode: "no_winner" });
    expect(r.mode).toBe("none");
    expect(r.winnerIds).toEqual([]);
  });

  it("nearest väljer lägst total avvikelse", () => {
    const bets: BetLike[] = [
      { participantId: "a", answer: { home: 1, away: 1 } }, // avvikelse 2
      { participantId: "b", answer: { home: 3, away: 0 } }, // avvikelse 3
    ];
    const r = computeGameWinners("result_90", bets, { home: 2, away: 2 }, { closestMode: "nearest" });
    expect(r.mode).toBe("nearest");
    expect(r.winnerIds).toEqual(["a"]);
  });

  it("nearest bryter lika på rätt målskillnad", () => {
    // Facit 2-1 (GD +1). Båda har avvikelse 2.
    const bets: BetLike[] = [
      { participantId: "a", answer: { home: 3, away: 2 } }, // GD +1 (rätt), avvikelse 2
      { participantId: "b", answer: { home: 1, away: 2 } }, // GD -1 (fel), avvikelse 2
    ];
    const r = computeGameWinners("result_90", bets, { home: 2, away: 1 }, { closestMode: "nearest" });
    expect(r.winnerIds).toEqual(["a"]);
  });

  it("nearest ger delad vinst mellan likvärdiga tips", () => {
    // Facit 2-2. Två spegelvända tips med samma avvikelse, samma (fel) GD och samma total.
    const bets: BetLike[] = [
      { participantId: "a", answer: { home: 3, away: 1 } },
      { participantId: "b", answer: { home: 1, away: 3 } },
    ];
    const r = computeGameWinners("result_90", bets, { home: 2, away: 2 }, { closestMode: "nearest" });
    expect(r.winnerIds.sort()).toEqual(["a", "b"]);
  });
});

describe("computeGameWinners – optionsspel", () => {
  it("alla med rätt svar vinner", () => {
    const bets: BetLike[] = [
      { participantId: "a", answer: { value: "yes" } },
      { participantId: "b", answer: { value: "no" } },
      { participantId: "c", answer: { value: "yes" } },
    ];
    const r = computeGameWinners("extra_time", bets, { value: "yes" });
    expect(r.winnerIds.sort()).toEqual(["a", "c"]);
  });

  it("inga vinnare om ingen prickade rätt", () => {
    const bets: BetLike[] = [{ participantId: "a", answer: { value: "no" } }];
    const r = computeGameWinners("extra_time", bets, { value: "yes" });
    expect(r.winnerIds).toEqual([]);
  });
});

describe("Matchpaketet", () => {
  const result = {
    world_champion: "team_one",
    result_90: { home: 2, away: 1 },
    first_scorer: "p1",
    extra_time: "no",
  };

  it("ger 1 poäng per korrekt del", () => {
    expect(
      computePackagePoints(
        { world_champion: "team_one", result_90: { home: 2, away: 1 }, first_scorer: "p1", extra_time: "no" },
        result,
      ),
    ).toBe(4);
    expect(
      computePackagePoints(
        { world_champion: "team_one", result_90: { home: 0, away: 0 }, first_scorer: "p2", extra_time: "no" },
        result,
      ),
    ).toBe(2);
  });

  it("flest poäng delar potten", () => {
    const bets: PackageBet[] = [
      { participantId: "a", answer: { world_champion: "team_one", first_scorer: "p1", extra_time: "no", result_90: { home: 2, away: 1 } } }, // 4
      { participantId: "b", answer: { world_champion: "team_one", first_scorer: "p1", extra_time: "no" } }, // 3
      { participantId: "c", answer: { world_champion: "team_one", result_90: { home: 2, away: 1 }, first_scorer: "p1", extra_time: "no" } }, // 4
    ];
    const r = computePackageWinners(bets, result);
    expect(r.topPoints).toBe(4);
    expect(r.winnerIds.sort()).toEqual(["a", "c"]);
  });

  it("utslagsfråga: närmast resultat bryter lika när aktiverat", () => {
    // Facit result_90 = 2-1. Båda missar resultatet men prickar de tre övriga delarna → 3 poäng var.
    const bets: PackageBet[] = [
      { participantId: "a", answer: { world_champion: "team_one", first_scorer: "p1", extra_time: "no", result_90: { home: 2, away: 2 } } }, // avvikelse 1
      { participantId: "b", answer: { world_champion: "team_one", first_scorer: "p1", extra_time: "no", result_90: { home: 5, away: 5 } } }, // avvikelse 7
    ];
    // Utan tiebreak: båda 3 poäng, delad.
    const shared = computePackageWinners(bets, { ...result, tiebreak_exact: false });
    expect(shared.topPoints).toBe(3);
    expect(shared.winnerIds.sort()).toEqual(["a", "b"]);
    // Med tiebreak: a ligger närmast facit → a vinner ensam.
    const decided = computePackageWinners(bets, { ...result, tiebreak_exact: true });
    expect(decided.winnerIds).toEqual(["a"]);
  });

  it("ingen vinnare om alla har 0 poäng", () => {
    const bets: PackageBet[] = [
      { participantId: "a", answer: { world_champion: "team_two", first_scorer: "px", extra_time: "yes", result_90: { home: 9, away: 9 } } },
    ];
    const r = computePackageWinners(bets, result);
    expect(r.winnerIds).toEqual([]);
    expect(r.mode).toBe("none");
  });

  it("assemblePackageResult bygger facit från ordinarie spel", () => {
    const pr = assemblePackageResult(
      {
        world_champion: { value: "team_one" },
        first_scorer: { value: "p1" },
        extra_time: { value: "no" },
        result_90: { home: 2, away: 1 },
      },
      true,
    );
    expect(pr).toEqual({
      world_champion: "team_one",
      first_scorer: "p1",
      extra_time: "no",
      result_90: { home: 2, away: 1 },
      tiebreak_exact: true,
    });
  });
});
