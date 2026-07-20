// Beräknar sammanställning (insats/vinst/netto per deltagare) utifrån sparade
// bets och game_winners. Server-only.

import "server-only";
import { getParticipants, getGames, getAllBets, getAllWinners, getEventById } from "./queries";
import { potFor, round2 } from "./scoring/payouts";
import { distributeUnwonPots, type UnwonGame } from "./scoring/unwon";
import type { PaymentStatus } from "./types";

export interface ParticipantStanding {
  id: string;
  name: string;
  paymentStatus: PaymentStatus;
  adminNote: string | null;
  wins: number;
  /** Antal spel deltagaren faktiskt lagt tips på. 0 = har gått med men inte spelat. */
  betCount: number;
  totalStake: number;
  totalWinnings: number;
  /**
   * Andel av potter som ingen vann – återbetald insats eller överrullad jackpot,
   * beroende på eventets policy. Ingår i `net`.
   */
  unwonCredit: number;
  net: number;
  /**
   * Summan av utdelade poäng (poäng-event). game_winners.payout bär pengar för
   * betting-event och poäng för poäng-event – detta är samma summa som heltal.
   */
  points: number;
}

export interface GameStat {
  gameId: string;
  betCount: number;
  pot: number;
  stake: number;
  winnerIds: string[];
  payoutPerWinner: number;
}

export interface Standings {
  participants: ParticipantStanding[];
  gameStats: Record<string, GameStat>;
  /** Totalt belopp i avgjorda spel som ingen vann. */
  unwonPot: number;
  /** Hur mycket av det som rullades över till jackpotvinnarna. */
  rolledOverToJackpot: number;
  /** Hur mycket som betalades tillbaka till dem som satsat. */
  refunded: number;
  /** Policyn sa "jackpot" men det fanns ingen jackpotvinnare – återbetalning användes. */
  jackpotFallback: boolean;
}

export async function computeStandings(eventId: string): Promise<Standings> {
  const [event, participants, games, bets, winners] = await Promise.all([
    getEventById(eventId),
    getParticipants(eventId),
    getGames(eventId),
    getAllBets(eventId),
    getAllWinners(eventId),
  ]);

  const betCountByGame: Record<string, number> = {};
  const stakeByParticipant: Record<string, number> = {};
  const betCountByParticipant: Record<string, number> = {};
  const betsByGame: Record<string, typeof bets> = {};
  for (const b of bets) {
    betCountByGame[b.gameId] = (betCountByGame[b.gameId] ?? 0) + 1;
    stakeByParticipant[b.participantId] = (stakeByParticipant[b.participantId] ?? 0) + b.stake;
    betCountByParticipant[b.participantId] = (betCountByParticipant[b.participantId] ?? 0) + 1;
    (betsByGame[b.gameId] ??= []).push(b);
  }

  const winnersByGame: Record<string, string[]> = {};
  const winningsByParticipant: Record<string, number> = {};
  const winsByParticipant: Record<string, number> = {};
  for (const w of winners) {
    (winnersByGame[w.gameId] ??= []).push(w.participantId);
    winningsByParticipant[w.participantId] = (winningsByParticipant[w.participantId] ?? 0) + w.payout;
    winsByParticipant[w.participantId] = (winsByParticipant[w.participantId] ?? 0) + 1;
  }

  const gameStats: Record<string, GameStat> = {};
  for (const g of games) {
    const betCount = betCountByGame[g.id] ?? 0;
    const winnerIds = winnersByGame[g.id] ?? [];
    const pot = potFor(betCount, g.stake);
    gameStats[g.id] = {
      gameId: g.id,
      betCount,
      pot,
      stake: g.stake,
      winnerIds,
      payoutPerWinner: winnerIds.length ? round2(pot / winnerIds.length) : 0,
    };
  }

  // Spel som är avgjorda (facit satt) men som ingen vann. Potten där måste ta
  // vägen någonstans, annars summerar inte nettona till noll och sammanräkningen
  // blir fel. Spel utan facit är inte "oavgjorda" – de är bara inte klara än.
  //
  // Poäng-event har ingen pott att fördela, så policyn gäller bara betting.
  const isBetting = event?.eventType !== "points";
  const unwonGames: UnwonGame[] = !isBetting
    ? []
    : games
        .filter(
          (g) =>
            g.resultData != null &&
            (winnersByGame[g.id]?.length ?? 0) === 0 &&
            (betsByGame[g.id]?.length ?? 0) > 0,
        )
        .map((g) => ({
          gameId: g.id,
          stakes: betsByGame[g.id].map((b) => ({ participantId: b.participantId, stake: b.stake })),
        }));

  const jackpotWinnerIds = games
    .filter((g) => g.isJackpot)
    .flatMap((g) => winnersByGame[g.id] ?? []);

  const dist = distributeUnwonPots(
    unwonGames,
    jackpotWinnerIds,
    event?.noWinnerPolicy ?? "refund",
  );

  const standings: ParticipantStanding[] = participants.map((p) => {
    const totalStake = round2(stakeByParticipant[p.id] ?? 0);
    const totalWinnings = round2(winningsByParticipant[p.id] ?? 0);
    const unwonCredit = round2(dist.credits[p.id] ?? 0);
    return {
      id: p.id,
      name: p.name,
      paymentStatus: p.paymentStatus,
      adminNote: p.adminNote,
      wins: winsByParticipant[p.id] ?? 0,
      betCount: betCountByParticipant[p.id] ?? 0,
      totalStake,
      totalWinnings,
      unwonCredit,
      net: round2(totalWinnings + unwonCredit - totalStake),
      points: Math.round(winningsByParticipant[p.id] ?? 0),
    };
  });

  return {
    participants: standings,
    gameStats,
    unwonPot: dist.totalUnwon,
    rolledOverToJackpot: dist.rolledOver,
    refunded: dist.refunded,
    jackpotFallback: dist.fellBackToRefund,
  };
}
