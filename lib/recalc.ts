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

/** Räknar om vinnare + utbetalningar för ett spel utifrån aktuellt facit. */
export async function recalcGame(gameId: string, audit = true): Promise<RecalcResult> {
  const game = await getGameById(gameId);
  if (!game) throw new Error("Spel saknas.");

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
    const event = await getEventById(game.eventId);
    const result = computeGameWinners(
      game.gameKey as AnyGameKey,
      bets.map((b) => ({ participantId: b.participantId, answer: b.answerData })),
      game.resultData,
      { closestMode: event?.closestResultMode },
    );
    winnerIds = result.winnerIds;
  }

  const perWinner = payoutPerWinner(pot, winnerIds.length);
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
