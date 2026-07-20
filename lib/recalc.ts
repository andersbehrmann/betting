// Kopplar ihop domänlogiken (scoring) med databasen. Körs varje gång admin
// sätter eller ändrar facit → skriver om vinnare och loggar i audit_log.

import "server-only";
import {
  getGameById,
  getEventById,
  getBetsForGame,
  replaceGameWinners,
  insertAudit,
} from "./queries";
import { computeGameWinners, computePackageWinners } from "./scoring/evaluate";
import { potFor, payoutPerWinner } from "./scoring/payouts";
import { PACKAGE_GAME_KEY } from "./scoring/types";
import type { AnyGameKey, PackageAnswer, PackageResult } from "./scoring/types";

export interface RecalcResult {
  winnerIds: string[];
  pot: number;
  perWinner: number;
}

/**
 * Räknar om vinnare + utdelning för ett spel utifrån aktuellt facit.
 *
 * Vinnardetekteringen är gemensam för båda event-typerna – det enda som skiljer
 * är vad varje vinnare tilldelas (lagras i game_winners.payout):
 *   betting → sin andel av potten, points → spelets poängvärde.
 */
export async function recalcGame(gameId: string, audit = true): Promise<RecalcResult> {
  const game = await getGameById(gameId);
  if (!game) throw new Error("Spel saknas.");

  const event = await getEventById(game.eventId);
  const isPoints = event?.eventType === "points";

  const bets = await getBetsForGame(gameId);
  const pot = potFor(bets.length, game.stake);

  if (game.resultData == null) {
    await replaceGameWinners(gameId, []);
    return { winnerIds: [], pot, perWinner: 0 };
  }

  let winnerIds: string[];
  if (game.gameKey === PACKAGE_GAME_KEY) {
    const pkgBets = bets.map((b) => ({
      participantId: b.participantId,
      answer: b.answerData as PackageAnswer,
    }));
    winnerIds = computePackageWinners(pkgBets, game.resultData as PackageResult).winnerIds;
  } else {
    const result = computeGameWinners(
      game.gameKey as AnyGameKey,
      bets.map((b) => ({ participantId: b.participantId, answer: b.answerData })),
      game.resultData,
      { closestMode: event?.closestResultMode },
    );
    winnerIds = result.winnerIds;
  }

  // Poäng-event: alla som svarat rätt får spelets fulla poäng (ingen delning).
  const perWinner = isPoints ? game.points : payoutPerWinner(pot, winnerIds.length);
  await replaceGameWinners(
    gameId,
    winnerIds.map((id) => ({ participantId: id, payout: perWinner, isManual: false })),
  );

  if (audit) {
    await insertAudit(game.eventId, "system", "recalc_game", gameId, {
      gameKey: game.gameKey,
      pot,
      winnerCount: winnerIds.length,
      perWinner,
    });
  }

  return { winnerIds, pot, perWinner };
}
