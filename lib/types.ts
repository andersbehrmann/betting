// App-nivå datatyper (mappade från DB-rader – numbers/booleans/Date normaliserade).

import type { GameResult, Answer, ClosestResultMode } from "./scoring/types";

export type PaymentStatus = "unpaid" | "paid" | "settled";
export type GameStatus = "open" | "closed" | "awaiting_result" | "settled";

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  teamOne: string;
  teamTwo: string;
  matchStart: Date;
  bettingDeadline: Date;
  bettingOpen: boolean;
  currency: string;
  defaultStake: number;
  jackpotStake: number;
  starPlayerName: string | null;
  starListenTarget: string | null;
  countStaffCards: boolean;
  closestResultMode: ClosestResultMode;
  packageTiebreakExact: boolean;
  leaderboardVisible: boolean;
  betsPublic: boolean;
}

export interface PlayerRow {
  id: string;
  eventId: string;
  name: string;
  team: 1 | 2;
  sortOrder: number;
}

export interface ParticipantRow {
  id: string;
  eventId: string;
  name: string;
  accessToken: string;
  paymentStatus: PaymentStatus;
  adminNote: string | null;
}

export interface GameRow {
  id: string;
  eventId: string;
  gameKey: string;
  title: string;
  description: string | null;
  stake: number;
  isJackpot: boolean;
  active: boolean;
  sortOrder: number;
  resultData: GameResult | null;
  status: GameStatus;
  settledAt: Date | null;
}

export interface BetRow {
  id: string;
  participantId: string;
  gameId: string;
  answerData: Answer;
  stake: number;
}

export interface GameWinnerRow {
  id: string;
  gameId: string;
  participantId: string;
  payout: number;
  isManual: boolean;
}
