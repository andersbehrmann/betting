// App-nivå datatyper (mappade från DB-rader – numbers/booleans/Date normaliserade).

import type { GameResult, Answer, ClosestResultMode, GameOption } from "./scoring/types";

export type PaymentStatus = "unpaid" | "paid" | "settled";
export type GameStatus = "open" | "closed" | "awaiting_result" | "settled";
export type EventType = "betting" | "points";
export type EventStatus = "draft" | "open" | "closed";
export type JoinFeeStatus = "none" | "pending" | "paid" | "refunded";

export interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  eventType: EventType;
  status: EventStatus;
  joinFeeCents: number;
  description: string | null;
  coverImageUrl: string | null;
  createdBy: string | null;
  // Fotbollsspecifika fält – null för generiska/poäng-event.
  teamOne: string | null;
  teamTwo: string | null;
  matchStart: Date | null;
  bettingDeadline: Date | null;
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
  userId: string | null;
  name: string;
  accessToken: string | null;
  paymentStatus: PaymentStatus;
  joinFeeStatus: JoinFeeStatus;
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
  bettingOpen: boolean;
  isCustom: boolean;
  options: GameOption[] | null;
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
