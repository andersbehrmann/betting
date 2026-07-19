// Ren vinstberäkningslogik. Ingen DB, inga sidoeffekter → lätt att enhetstesta.

import type {
  AnyGameKey,
  Answer,
  ClosestResultMode,
  GameResult,
  OptionAnswer,
  PackageAnswer,
  PackageResult,
  ScoreAnswer,
} from "./types";
import { PACKAGE_GAME_KEY } from "./types";

export interface BetLike {
  participantId: string;
  answer: Answer;
}

export type WinnerMode = "exact" | "nearest" | "none";

export interface WinnerResult {
  winnerIds: string[];
  mode: WinnerMode;
}

function isScore(v: unknown): v is ScoreAnswer {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as ScoreAnswer).home === "number" &&
    typeof (v as ScoreAnswer).away === "number"
  );
}

function scoreEquals(a: ScoreAnswer, b: ScoreAnswer): boolean {
  return a.home === b.home && a.away === b.away;
}

/**
 * Är ett enskilt tips korrekt givet facit? Används för alla spel utom
 * "närmast"-fallet i result_90 (som kräver jämförelse mellan alla tips).
 */
export function isCorrect(
  key: AnyGameKey,
  answer: Answer,
  result: GameResult,
): boolean {
  if (answer == null || result == null) return false;

  if (key === "result_90") {
    if (!isScore(answer) || !isScore(result)) return false;
    return scoreEquals(answer, result);
  }

  if (key === PACKAGE_GAME_KEY) {
    // Matchpaketet avgörs via poäng, inte binärt – se computePackagePoints.
    return false;
  }

  // Alla övriga spel: enkel jämförelse av valt värde.
  const a = answer as OptionAnswer;
  const r = result as OptionAnswer;
  return typeof a.value === "string" && a.value === r.value;
}

/** Sorteringsnyckel för "närmast": lägre är bättre, jämförs lexikografiskt. */
function nearnessKey(bet: ScoreAnswer, result: ScoreAnswer): [number, number, number] {
  const deviation = Math.abs(bet.home - result.home) + Math.abs(bet.away - result.away);
  const gdCorrect = bet.home - bet.away === result.home - result.away ? 0 : 1;
  const totalCorrect = bet.home + bet.away === result.home + result.away ? 0 : 1;
  return [deviation, gdCorrect, totalCorrect];
}

function keyLte(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Räknar ut vinnarna i ett spel givet alla tips och facit.
 * För result_90 hanteras exakt → annars "närmast" enligt closestMode.
 */
export function computeGameWinners(
  key: AnyGameKey,
  bets: BetLike[],
  result: GameResult,
  opts: { closestMode?: ClosestResultMode } = {},
): WinnerResult {
  if (result == null || bets.length === 0) return { winnerIds: [], mode: "none" };

  if (key === "result_90") {
    if (!isScore(result)) return { winnerIds: [], mode: "none" };
    const exact = bets.filter((b) => isScore(b.answer) && scoreEquals(b.answer, result));
    if (exact.length > 0) {
      return { winnerIds: exact.map((b) => b.participantId), mode: "exact" };
    }
    if ((opts.closestMode ?? "no_winner") === "no_winner") {
      return { winnerIds: [], mode: "none" };
    }
    // Närmast: hitta bästa nyckel, alla med den nyckeln delar vinsten.
    const scored = bets
      .filter((b) => isScore(b.answer))
      .map((b) => ({ id: b.participantId, key: nearnessKey(b.answer as ScoreAnswer, result) }));
    if (scored.length === 0) return { winnerIds: [], mode: "none" };
    let best = scored[0].key;
    for (const s of scored) if (keyLte(s.key, best) < 0) best = s.key;
    const winners = scored.filter((s) => keyLte(s.key, best) === 0);
    return { winnerIds: winners.map((s) => s.id), mode: "nearest" };
  }

  const winners = bets.filter((b) => isCorrect(key, b.answer, result));
  return { winnerIds: winners.map((b) => b.participantId), mode: "exact" };
}

// --- Matchpaketet ---

/** Poäng (0–4) för ett matchpaket-tips givet facit för de fyra delarna. */
export function computePackagePoints(
  answer: PackageAnswer,
  result: PackageResult,
): number {
  let points = 0;
  if (answer.world_champion && result.world_champion &&
      answer.world_champion === result.world_champion) points++;
  if (isScore(answer.result_90) && isScore(result.result_90) &&
      scoreEquals(answer.result_90, result.result_90)) points++;
  if (answer.first_scorer && result.first_scorer &&
      answer.first_scorer === result.first_scorer) points++;
  if (answer.extra_time && result.extra_time &&
      answer.extra_time === result.extra_time) points++;
  return points;
}

export interface PackageBet {
  participantId: string;
  answer: PackageAnswer;
}

export interface PackageWinnerResult extends WinnerResult {
  points: Record<string, number>;
  topPoints: number;
}

/**
 * Vinnare i matchpaketet: flest poäng delar potten.
 * Om result.tiebreak_exact är satt används exakt result_90 som utslag bland de likvärdiga.
 */
export function computePackageWinners(
  bets: PackageBet[],
  result: PackageResult,
): PackageWinnerResult {
  const points: Record<string, number> = {};
  for (const b of bets) points[b.participantId] = computePackagePoints(b.answer, result);

  if (bets.length === 0) return { winnerIds: [], mode: "none", points, topPoints: 0 };

  const topPoints = Math.max(...bets.map((b) => points[b.participantId]));
  if (topPoints === 0) return { winnerIds: [], mode: "none", points, topPoints };

  let top = bets.filter((b) => points[b.participantId] === topPoints);

  // Utslagsfråga: bland likvärdiga tips vinner de vars result_90-gissning ligger
  // närmast det verkliga resultatet (lägst total avvikelse). Fortfarande lika → delas.
  if (result.tiebreak_exact && top.length > 1 && isScore(result.result_90)) {
    const withScore = top.filter((b) => isScore(b.answer.result_90));
    if (withScore.length > 0) {
      const dev = (b: PackageBet) =>
        Math.abs((b.answer.result_90 as ScoreAnswer).home - result.result_90!.home) +
        Math.abs((b.answer.result_90 as ScoreAnswer).away - result.result_90!.away);
      const best = Math.min(...withScore.map(dev));
      top = withScore.filter((b) => dev(b) === best);
    }
  }

  return { winnerIds: top.map((b) => b.participantId), mode: "exact", points, topPoints };
}

/** Bygger matchpaket-facit från de ordinarie spelens facit. */
export function assemblePackageResult(
  ordinaryResults: Partial<Record<string, GameResult>>,
  tiebreakExact: boolean,
): PackageResult {
  const wc = ordinaryResults["world_champion"] as OptionAnswer | undefined;
  const fs = ordinaryResults["first_scorer"] as OptionAnswer | undefined;
  const et = ordinaryResults["extra_time"] as OptionAnswer | undefined;
  const r90 = ordinaryResults["result_90"] as ScoreAnswer | undefined;
  return {
    world_champion: wc?.value,
    result_90: isScore(r90) ? r90 : undefined,
    first_scorer: fs?.value,
    extra_time: et?.value,
    tiebreak_exact: tiebreakExact,
  };
}
