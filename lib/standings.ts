// Beräknar sammanställning (insats/vinst/netto per deltagare) utifrån sparade
// bets och game_winners. Server-only.

import "server-only";
import { getParticipants, getGames, getAllBets, getAllWinners } from "./queries";
import { potFor, round2 } from "./scoring/payouts";
import type { PaymentStatus } from "./types";

export interface ParticipantStanding {
  id: string;
  name: string;
  paymentStatus: PaymentStatus;
  adminNote: string | null;
  wins: number;
  totalStake: number;
  totalWinnings: number;
  net: number;
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
}

export async function computeStandings(eventId: string): Promise<Standings> {
  const [participants, games, bets, winners] = await Promise.all([
    getParticipants(eventId),
    getGames(eventId),
    getAllBets(eventId),
    getAllWinners(eventId),
  ]);

  const betCountByGame: Record<string, number> = {};
  const stakeByParticipant: Record<string, number> = {};
  for (const b of bets) {
    betCountByGame[b.gameId] = (betCountByGame[b.gameId] ?? 0) + 1;
    stakeByParticipant[b.participantId] = (stakeByParticipant[b.participantId] ?? 0) + b.stake;
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

  const standings: ParticipantStanding[] = participants.map((p) => {
    const totalStake = round2(stakeByParticipant[p.id] ?? 0);
    const totalWinnings = round2(winningsByParticipant[p.id] ?? 0);
    return {
      id: p.id,
      name: p.name,
      paymentStatus: p.paymentStatus,
      adminNote: p.adminNote,
      wins: winsByParticipant[p.id] ?? 0,
      totalStake,
      totalWinnings,
      net: round2(totalWinnings - totalStake),
    };
  });

  return { participants: standings, gameStats };
}
