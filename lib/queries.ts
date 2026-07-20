// Typade databasfrågor. Endast server-side (importerar lib/db).

import "server-only";
import { randomBytes } from "node:crypto";
import { sql, num, toDate } from "./db";
import type {
  EventRow,
  PlayerRow,
  ParticipantRow,
  GameRow,
  BetRow,
  GameWinnerRow,
  PaymentStatus,
  GameStatus,
  UserRow,
  ProposalRow,
  ProposalStatus,
  FriendLeaderboardRow,
  NoWinnerPolicy,
} from "./types";
import type { Answer, GameResult } from "./scoring/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Mappers (snake_case DB → camelCase app) ---

function mapEvent(r: any): EventRow {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    eventType: r.event_type,
    status: r.status,
    joinFeeCents: r.join_fee_cents,
    description: r.description ?? null,
    coverImageUrl: r.cover_image_url ?? null,
    createdBy: r.created_by ?? null,
    teamOne: r.team_one ?? null,
    teamTwo: r.team_two ?? null,
    matchStart: r.match_start ? toDate(r.match_start) : null,
    bettingDeadline: r.betting_deadline ? toDate(r.betting_deadline) : null,
    bettingOpen: r.betting_open,
    currency: r.currency,
    defaultStake: num(r.default_stake),
    jackpotStake: num(r.jackpot_stake),
    starPlayerName: r.star_player_name,
    starListenTarget: r.star_listen_target,
    countStaffCards: r.count_staff_cards,
    closestResultMode: r.closest_result_mode,
    packageTiebreakExact: r.package_tiebreak_exact,
    leaderboardVisible: r.leaderboard_visible,
    betsPublic: r.bets_public,
    noWinnerPolicy: r.no_winner_policy ?? "refund",
  };
}

function mapPlayer(r: any): PlayerRow {
  return { id: r.id, eventId: r.event_id, name: r.name, team: r.team, sortOrder: r.sort_order };
}

function mapParticipant(r: any): ParticipantRow {
  return {
    id: r.id,
    eventId: r.event_id,
    userId: r.user_id ?? null,
    name: r.name,
    paymentStatus: r.payment_status,
    joinFeeStatus: r.join_fee_status ?? "none",
    adminNote: r.admin_note,
  };
}

function mapGame(r: any): GameRow {
  return {
    id: r.id,
    eventId: r.event_id,
    gameKey: r.game_key,
    title: r.title,
    description: r.description,
    stake: num(r.stake),
    points: num(r.points ?? 0),
    isJackpot: r.is_jackpot,
    active: r.active,
    bettingOpen: r.betting_open,
    isCustom: r.is_custom,
    options: r.options ?? null,
    sortOrder: r.sort_order,
    resultData: r.result_data,
    status: r.status,
    settledAt: r.settled_at ? toDate(r.settled_at) : null,
  };
}

function mapBet(r: any): BetRow {
  return {
    id: r.id,
    participantId: r.participant_id,
    gameId: r.game_id,
    answerData: r.answer_data,
    stake: num(r.stake),
  };
}

function mapWinner(r: any): GameWinnerRow {
  return {
    id: r.id,
    gameId: r.game_id,
    participantId: r.participant_id,
    payout: num(r.payout),
    isManual: r.is_manual,
  };
}

// --- Events ---

export async function getEventById(id: string): Promise<EventRow | null> {
  const rows = await sql`SELECT * FROM events WHERE id = ${id}`;
  return rows[0] ? mapEvent(rows[0]) : null;
}

/** Event via slug – för /events/[slug]. */
export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const rows = await sql`SELECT * FROM events WHERE slug = ${slug}`;
  return rows[0] ? mapEvent(rows[0]) : null;
}

/** Publikt bläddringsbara event (ej draft), nyast först. */
export async function listBrowsableEvents(): Promise<EventRow[]> {
  const rows = await sql`
    SELECT * FROM events WHERE status IN ('open', 'closed') ORDER BY created_at DESC`;
  return rows.map(mapEvent);
}

/** Alla event (admin), nyast först. */
export async function listAllEvents(): Promise<EventRow[]> {
  const rows = await sql`SELECT * FROM events ORDER BY created_at DESC`;
  return rows.map(mapEvent);
}

export interface PlatformEventInput {
  name: string;
  slug: string;
  eventType: "betting" | "points";
  joinFeeCents: number;
  currency: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  createdBy: string | null;
}

/** Skapar ett generiskt plattforms-event (utan fotbollsfält/standardspel). */
export async function createPlatformEvent(input: PlatformEventInput): Promise<string> {
  const rows = await sql`
    INSERT INTO events
      (name, slug, event_type, join_fee_cents, currency, description, status, created_by)
    VALUES
      (${input.name}, ${input.slug}, ${input.eventType}, ${input.joinFeeCents},
       ${input.currency}, ${input.description}, ${input.status}, ${input.createdBy})
    RETURNING id`;
  return rows[0].id as string;
}

export async function setEventStatus(
  eventId: string,
  status: "draft" | "open" | "closed",
): Promise<void> {
  await sql`UPDATE events SET status = ${status} WHERE id = ${eventId}`;
}

// --- Fotbolls-event-inställningar (legacy match-form) ---

export interface EventSettingsInput {
  name: string;
  teamOne: string | null;
  teamTwo: string | null;
  matchStart: Date | null;
  bettingDeadline: Date | null;
  currency: string;
  defaultStake: number;
  jackpotStake: number;
  starPlayerName: string | null;
  starListenTarget: string | null;
  countStaffCards: boolean;
  closestResultMode: "nearest" | "no_winner";
  packageTiebreakExact: boolean;
  noWinnerPolicy: NoWinnerPolicy;
}

export async function updateEventSettings(id: string, s: EventSettingsInput): Promise<void> {
  await sql`
    UPDATE events SET
      name = ${s.name},
      team_one = ${s.teamOne},
      team_two = ${s.teamTwo},
      match_start = ${s.matchStart ? s.matchStart.toISOString() : null},
      betting_deadline = ${s.bettingDeadline ? s.bettingDeadline.toISOString() : null},
      currency = ${s.currency},
      default_stake = ${s.defaultStake},
      jackpot_stake = ${s.jackpotStake},
      star_player_name = ${s.starPlayerName},
      star_listen_target = ${s.starListenTarget},
      count_staff_cards = ${s.countStaffCards},
      closest_result_mode = ${s.closestResultMode},
      package_tiebreak_exact = ${s.packageTiebreakExact},
      no_winner_policy = ${s.noWinnerPolicy}
    WHERE id = ${id}`;
}

export async function setBettingOpen(eventId: string, open: boolean): Promise<void> {
  await sql`UPDATE events SET betting_open = ${open} WHERE id = ${eventId}`;
}

export async function setEventFlag(
  eventId: string,
  flag: "leaderboard_visible" | "bets_public",
  value: boolean,
): Promise<void> {
  // Kolumnnamnet är från en fast whitelist ovan – säkert att interpolera.
  await sql.query(`UPDATE events SET ${flag} = $1 WHERE id = $2`, [value, eventId]);
}

// --- Players ---

export async function getPlayers(eventId: string): Promise<PlayerRow[]> {
  const rows = await sql`SELECT * FROM players WHERE event_id = ${eventId} ORDER BY team, sort_order, name`;
  return rows.map(mapPlayer);
}

/** Ersätter hela spelarlistan för ett event (i en transaktion). */
export async function replacePlayers(
  eventId: string,
  players: { name: string; team: 1 | 2 }[],
): Promise<void> {
  const inserts = players.map(
    (p, i) =>
      sql`INSERT INTO players (event_id, name, team, sort_order) VALUES (${eventId}, ${p.name}, ${p.team}, ${i})`,
  );
  await sql.transaction([sql`DELETE FROM players WHERE event_id = ${eventId}`, ...inserts]);
}

// --- Participants ---

export async function getParticipants(eventId: string): Promise<ParticipantRow[]> {
  const rows = await sql`SELECT * FROM participants WHERE event_id = ${eventId} ORDER BY created_at`;
  return rows.map(mapParticipant);
}

export async function getParticipantByToken(token: string): Promise<ParticipantRow | null> {
  const rows = await sql`SELECT * FROM participants WHERE access_token = ${token}`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

/**
 * Deltagarens access_token, skapad vid behov.
 *
 * Kontobaserade medlemskap fick tidigare ingen token alls, vilket betydde att en
 * tappad session låste ut dig från din egen deltagarrad – det fanns ingen väg
 * tillbaka. Nu får alla deltagare en token, men den lämnar aldrig servern annat
 * än som värde i deltagarens egen httpOnly-cookie. Returnera den ALDRIG till en
 * klientkomponent och lägg den aldrig i ParticipantRow.
 */
export async function getOrCreateParticipantToken(participantId: string): Promise<string> {
  const existing = await sql`SELECT access_token FROM participants WHERE id = ${participantId}`;
  if (!existing[0]) throw new Error("Deltagare saknas.");
  if (existing[0].access_token) return existing[0].access_token as string;

  const token = randomBytes(16).toString("hex");
  // Villkoret på IS NULL gör skrivningen säker mot två samtidiga requests:
  // förloraren får noll rader tillbaka och läser om vinnarens token nedan.
  const updated = await sql`
    UPDATE participants SET access_token = ${token}
    WHERE id = ${participantId} AND access_token IS NULL
    RETURNING access_token`;
  if (updated[0]) return updated[0].access_token as string;

  const raced = await sql`SELECT access_token FROM participants WHERE id = ${participantId}`;
  return raced[0].access_token as string;
}

export async function participantNameExists(eventId: string, name: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM participants WHERE event_id = ${eventId} AND lower(name) = lower(${name}) LIMIT 1`;
  return rows.length > 0;
}

export async function createParticipant(
  eventId: string,
  name: string,
  token: string,
): Promise<ParticipantRow> {
  const rows = await sql`
    INSERT INTO participants (event_id, name, access_token)
    VALUES (${eventId}, ${name}, ${token})
    RETURNING *`;
  return mapParticipant(rows[0]);
}

export async function setPaymentStatus(
  participantId: string,
  status: PaymentStatus,
): Promise<void> {
  await sql`UPDATE participants SET payment_status = ${status} WHERE id = ${participantId}`;
}

export async function setAdminNote(participantId: string, note: string | null): Promise<void> {
  await sql`UPDATE participants SET admin_note = ${note} WHERE id = ${participantId}`;
}

// --- Medlemskap (kontobaserat: participant kopplad till user_id) ---

/** Användarens medlemskap i ett event (eller null). */
export async function getMembership(
  eventId: string,
  userId: string,
): Promise<ParticipantRow | null> {
  const rows = await sql`
    SELECT * FROM participants WHERE event_id = ${eventId} AND user_id = ${userId}`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

/** Skapar ett medlemskap för en inloggad användare. joinFeeStatus: 'none' för gratis, 'pending' inför Stripe. */
export async function createMembership(
  eventId: string,
  userId: string,
  name: string,
  joinFeeStatus: "none" | "pending",
): Promise<ParticipantRow> {
  const rows = await sql`
    INSERT INTO participants (event_id, user_id, name, join_fee_status)
    VALUES (${eventId}, ${userId}, ${name}, ${joinFeeStatus})
    RETURNING *`;
  return mapParticipant(rows[0]);
}

// --- Stripe-avstämning ---
// Invariant: join_fee_status = 'paid' sätts ENDAST av markMembershipPaid, som i
// sin tur bara anropas från den signaturverifierade Stripe-webhooken. Lägg inte
// till en generisk statussättare här – då kan grinden kringgås.

/** Kopplar en Checkout-session till medlemskapet så webhooken kan hitta tillbaka. */
export async function setMembershipCheckoutSession(
  participantId: string,
  sessionId: string,
): Promise<void> {
  await sql`
    UPDATE participants
    SET stripe_checkout_session_id = ${sessionId}, join_fee_status = 'pending'
    WHERE id = ${participantId}`;
}

export async function getMembershipByCheckoutSession(
  sessionId: string,
): Promise<ParticipantRow | null> {
  const rows = await sql`
    SELECT * FROM participants WHERE stripe_checkout_session_id = ${sessionId}`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

/** Markerar avgiften som betald. Idempotent – kan köras om utan bieffekt. */
export async function markMembershipPaid(
  participantId: string,
  paymentIntentId: string | null,
): Promise<void> {
  await sql`
    UPDATE participants
    SET join_fee_status = 'paid',
        join_fee_paid_at = now(),
        stripe_payment_intent_id = COALESCE(${paymentIntentId}, stripe_payment_intent_id)
    WHERE id = ${participantId}`;
}

/**
 * Registrerar ett Stripe-event i idempotens-liggaren.
 * Returnerar true bara första gången – då (och endast då) ska sidoeffekter köras.
 */
export async function recordStripeEvent(id: string, type: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO stripe_events (id, type) VALUES (${id}, ${type})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

/**
 * Tar bort en idempotens-rad. Används när hanteringen misslyckades efter att
 * raden skapats – annars skulle Stripes omförsök hoppas över och betalningen
 * aldrig registreras.
 */
export async function forgetStripeEvent(id: string): Promise<void> {
  await sql`DELETE FROM stripe_events WHERE id = ${id}`;
}

// --- Games ---

export async function getGames(eventId: string, onlyActive = false): Promise<GameRow[]> {
  const rows = onlyActive
    ? await sql`SELECT * FROM games WHERE event_id = ${eventId} AND active = true ORDER BY sort_order`
    : await sql`SELECT * FROM games WHERE event_id = ${eventId} ORDER BY sort_order`;
  return rows.map(mapGame);
}

export async function getGameById(id: string): Promise<GameRow | null> {
  const rows = await sql`SELECT * FROM games WHERE id = ${id}`;
  return rows[0] ? mapGame(rows[0]) : null;
}

export async function setGameActive(gameId: string, active: boolean): Promise<void> {
  await sql`UPDATE games SET active = ${active} WHERE id = ${gameId}`;
}

export async function setGameBettingOpen(gameId: string, open: boolean): Promise<void> {
  await sql`UPDATE games SET betting_open = ${open} WHERE id = ${gameId}`;
}

export interface CustomGameInput {
  title: string;
  description: string | null;
  stake: number;
  /** Poängvärde för poäng-event (ignoreras av betting-event). */
  points: number;
  options: { value: string; label: string }[];
  bettingOpen: boolean;
  /**
   * Utkast från ett godkänt förslag skapas dolt (active=false, status='draft')
   * så admin kan finjustera innan det publiceras. Default: publicerat direkt.
   */
  active?: boolean;
  status?: "draft" | "open";
  proposedBy?: string | null;
}

/** Skapar ett eget (custom) flervalsspel. Returnerar spelets id. */
export async function createCustomGame(
  eventId: string,
  gameKey: string,
  input: CustomGameInput,
): Promise<string> {
  const nextOrder = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM games WHERE event_id = ${eventId}`;
  const sortOrder = num(nextOrder[0].n);
  const rows = await sql`
    INSERT INTO games
      (event_id, game_key, title, description, stake, points, is_jackpot, is_custom, active,
       betting_open, sort_order, status, options, proposed_by)
    VALUES
      (${eventId}, ${gameKey}, ${input.title}, ${input.description}, ${input.stake}, ${input.points},
       false, true, ${input.active ?? true}, ${input.bettingOpen}, ${sortOrder},
       ${input.status ?? "open"}, ${JSON.stringify(input.options)}::jsonb, ${input.proposedBy ?? null})
    RETURNING id`;
  return rows[0].id as string;
}

export async function setGameResult(gameId: string, result: GameResult | null): Promise<void> {
  await sql`UPDATE games SET result_data = ${result ? JSON.stringify(result) : null}::jsonb WHERE id = ${gameId}`;
}

export async function setGameStatus(
  gameId: string,
  status: GameStatus,
  settled: boolean,
): Promise<void> {
  if (settled) {
    await sql`UPDATE games SET status = ${status}, settled_at = now() WHERE id = ${gameId}`;
  } else {
    await sql`UPDATE games SET status = ${status}, settled_at = NULL WHERE id = ${gameId}`;
  }
}

// --- Bets ---

export async function getBetsForParticipant(participantId: string): Promise<BetRow[]> {
  const rows = await sql`SELECT * FROM bets WHERE participant_id = ${participantId}`;
  return rows.map(mapBet);
}

export async function getBetsForGame(gameId: string): Promise<BetRow[]> {
  const rows = await sql`SELECT * FROM bets WHERE game_id = ${gameId}`;
  return rows.map(mapBet);
}

export async function getAllBets(eventId: string): Promise<BetRow[]> {
  const rows = await sql`
    SELECT b.* FROM bets b
    JOIN games g ON g.id = b.game_id
    WHERE g.event_id = ${eventId}`;
  return rows.map(mapBet);
}

export interface BetInput {
  gameId: string;
  answer: Answer;
  stake: number;
}

/**
 * Sparar deltagarens tips: upsert av valda spel + borttagning av avvalda.
 * Allt i en transaktion.
 */
export async function saveBets(
  participantId: string,
  selected: BetInput[],
  removedGameIds: string[],
): Promise<void> {
  const upserts = selected.map(
    (b) =>
      sql`
        INSERT INTO bets (participant_id, game_id, answer_data, stake)
        VALUES (${participantId}, ${b.gameId}, ${JSON.stringify(b.answer)}::jsonb, ${b.stake})
        ON CONFLICT (participant_id, game_id)
        DO UPDATE SET answer_data = EXCLUDED.answer_data, stake = EXCLUDED.stake, updated_at = now()`,
  );
  const deletes = removedGameIds.map(
    (gid) => sql`DELETE FROM bets WHERE participant_id = ${participantId} AND game_id = ${gid}`,
  );
  const stmts = [...upserts, ...deletes];
  if (stmts.length > 0) await sql.transaction(stmts);
}

// --- Winners ---

export async function getWinnersForGame(gameId: string): Promise<GameWinnerRow[]> {
  const rows = await sql`SELECT * FROM game_winners WHERE game_id = ${gameId}`;
  return rows.map(mapWinner);
}

export async function getAllWinners(eventId: string): Promise<GameWinnerRow[]> {
  const rows = await sql`
    SELECT w.* FROM game_winners w
    JOIN games g ON g.id = w.game_id
    WHERE g.event_id = ${eventId}`;
  return rows.map(mapWinner);
}

/** Ersätter vinnare för ett spel (delete + insert i transaktion). */
export async function replaceGameWinners(
  gameId: string,
  winners: { participantId: string; payout: number; isManual: boolean }[],
): Promise<void> {
  const inserts = winners.map(
    (w) =>
      sql`INSERT INTO game_winners (game_id, participant_id, payout, is_manual)
          VALUES (${gameId}, ${w.participantId}, ${w.payout}, ${w.isManual})`,
  );
  await sql.transaction([sql`DELETE FROM game_winners WHERE game_id = ${gameId}`, ...inserts]);
}

// --- Audit ---

export async function insertAudit(
  eventId: string,
  actor: "admin" | "system",
  action: string,
  gameId: string | null,
  detail: unknown,
): Promise<void> {
  await sql`
    INSERT INTO audit_log (event_id, actor, action, game_id, detail)
    VALUES (${eventId}, ${actor}, ${action}, ${gameId}, ${detail ? JSON.stringify(detail) : null}::jsonb)`;
}

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  gameId: string | null;
  detail: unknown;
  createdAt: Date;
}

export async function getAuditLog(eventId: string, limit = 100): Promise<AuditRow[]> {
  const rows = await sql`
    SELECT * FROM audit_log WHERE event_id = ${eventId} ORDER BY created_at DESC LIMIT ${limit}`;
  return (rows as any[]).map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    gameId: r.game_id,
    detail: r.detail,
    createdAt: toDate(r.created_at),
  }));
}

// --- Kompis-leaderboards (privata delligor) ---

function mapFriendLeaderboard(r: any): FriendLeaderboardRow {
  return {
    id: r.id,
    eventId: r.event_id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    inviteCode: r.invite_code,
    memberCount: num(r.member_count ?? 0),
    createdAt: toDate(r.created_at),
  };
}

export async function createFriendLeaderboard(
  eventId: string,
  ownerUserId: string,
  name: string,
  inviteCode: string,
): Promise<FriendLeaderboardRow> {
  // Ägaren blir automatiskt medlem i sin egen liga.
  const rows = await sql`
    INSERT INTO friend_leaderboards (event_id, owner_user_id, name, invite_code)
    VALUES (${eventId}, ${ownerUserId}, ${name}, ${inviteCode})
    RETURNING *`;
  const lb = mapFriendLeaderboard(rows[0]);
  await sql`
    INSERT INTO friend_leaderboard_members (leaderboard_id, user_id, status)
    VALUES (${lb.id}, ${ownerUserId}, 'joined')
    ON CONFLICT (leaderboard_id, user_id) DO NOTHING`;
  return lb;
}

/** Ligor i eventet som användaren är medlem i. */
export async function listFriendLeaderboardsForUser(
  eventId: string,
  userId: string,
): Promise<FriendLeaderboardRow[]> {
  const rows = await sql`
    SELECT l.*, (SELECT count(*) FROM friend_leaderboard_members m2
                 WHERE m2.leaderboard_id = l.id AND m2.status = 'joined') AS member_count
    FROM friend_leaderboards l
    JOIN friend_leaderboard_members m ON m.leaderboard_id = l.id
    WHERE l.event_id = ${eventId} AND m.user_id = ${userId} AND m.status = 'joined'
    ORDER BY l.created_at`;
  return rows.map(mapFriendLeaderboard);
}

export async function getFriendLeaderboardById(
  id: string,
): Promise<FriendLeaderboardRow | null> {
  const rows = await sql`
    SELECT l.*, (SELECT count(*) FROM friend_leaderboard_members m
                 WHERE m.leaderboard_id = l.id AND m.status = 'joined') AS member_count
    FROM friend_leaderboards l WHERE l.id = ${id}`;
  return rows[0] ? mapFriendLeaderboard(rows[0]) : null;
}

export async function getFriendLeaderboardByInviteCode(
  code: string,
): Promise<FriendLeaderboardRow | null> {
  const rows = await sql`
    SELECT l.*, 0 AS member_count FROM friend_leaderboards l WHERE l.invite_code = ${code}`;
  return rows[0] ? mapFriendLeaderboard(rows[0]) : null;
}

/**
 * Är användaren medlem? Detta är sekretessgrinden – en liga får ALDRIG visas
 * för någon som inte är med.
 */
export async function isFriendLeaderboardMember(
  leaderboardId: string,
  userId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM friend_leaderboard_members
    WHERE leaderboard_id = ${leaderboardId} AND user_id = ${userId} AND status = 'joined'
    LIMIT 1`;
  return rows.length > 0;
}

export async function addFriendLeaderboardMember(
  leaderboardId: string,
  userId: string,
): Promise<void> {
  await sql`
    INSERT INTO friend_leaderboard_members (leaderboard_id, user_id, status)
    VALUES (${leaderboardId}, ${userId}, 'joined')
    ON CONFLICT (leaderboard_id, user_id) DO UPDATE SET status = 'joined'`;
}

/** Deltagarrader i eventet för ligans medlemmar – underlag för privat ställning. */
export async function getFriendLeaderboardParticipantIds(
  leaderboardId: string,
  eventId: string,
): Promise<string[]> {
  const rows = await sql`
    SELECT p.id FROM friend_leaderboard_members m
    JOIN participants p ON p.user_id = m.user_id AND p.event_id = ${eventId}
    WHERE m.leaderboard_id = ${leaderboardId} AND m.status = 'joined'`;
  return (rows as any[]).map((r) => r.id as string);
}

// --- Spelförslag ---

function mapProposal(r: any): ProposalRow {
  return {
    id: r.id,
    eventId: r.event_id,
    proposedBy: r.proposed_by,
    proposerName: r.proposer_name ?? null,
    title: r.title,
    description: r.description ?? null,
    suggestedOptions: r.suggested_options ?? null,
    status: r.status,
    adminNote: r.admin_note ?? null,
    createdGameId: r.created_game_id ?? null,
    createdAt: toDate(r.created_at),
  };
}

export async function createProposal(input: {
  eventId: string;
  proposedBy: string;
  title: string;
  description: string | null;
  suggestedOptions: { value: string; label: string }[];
}): Promise<ProposalRow> {
  const rows = await sql`
    INSERT INTO game_proposals (event_id, proposed_by, title, description, suggested_options)
    VALUES (${input.eventId}, ${input.proposedBy}, ${input.title}, ${input.description},
            ${JSON.stringify(input.suggestedOptions)}::jsonb)
    RETURNING *`;
  return mapProposal(rows[0]);
}

/** Förslag för ett event, nyast först. Joinar in förslagsställarens namn. */
export async function listProposals(
  eventId: string,
  status?: ProposalStatus,
): Promise<ProposalRow[]> {
  const rows = status
    ? await sql`
        SELECT p.*, u.name AS proposer_name FROM game_proposals p
        JOIN users u ON u.id = p.proposed_by
        WHERE p.event_id = ${eventId} AND p.status = ${status}
        ORDER BY p.created_at DESC`
    : await sql`
        SELECT p.*, u.name AS proposer_name FROM game_proposals p
        JOIN users u ON u.id = p.proposed_by
        WHERE p.event_id = ${eventId}
        ORDER BY p.created_at DESC`;
  return rows.map(mapProposal);
}

export async function countPendingProposals(eventId: string): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM game_proposals
    WHERE event_id = ${eventId} AND status = 'pending'`;
  return num(rows[0].n);
}

export async function getProposalById(id: string): Promise<ProposalRow | null> {
  const rows = await sql`
    SELECT p.*, u.name AS proposer_name FROM game_proposals p
    JOIN users u ON u.id = p.proposed_by
    WHERE p.id = ${id}`;
  return rows[0] ? mapProposal(rows[0]) : null;
}

/** Markerar ett förslag som granskat (godkänt/avslaget). */
export async function resolveProposal(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string | null,
  adminNote: string | null,
  createdGameId: string | null,
): Promise<void> {
  await sql`
    UPDATE game_proposals
    SET status = ${status}, reviewed_by = ${reviewedBy}, admin_note = ${adminNote},
        created_game_id = ${createdGameId}, reviewed_at = now()
    WHERE id = ${id}`;
}

/** Adminanvändare – för notiser om nya förslag. */
export async function getAdminUsers(): Promise<UserRow[]> {
  const rows = await sql`SELECT * FROM users WHERE is_admin = true`;
  return rows.map(mapUser);
}

// --- Users / Sessions / Auth ---
// UserRow är en DTO utan password_hash – hashen lämnar aldrig detta lager annat än
// via getUserAuthByEmail (endast för lösenordsverifiering vid inloggning).

function mapUser(r: any): UserRow {
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    email: r.email,
    isAdmin: r.is_admin,
  };
}

export interface NewUserInput {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  isAdmin?: boolean;
}

export async function createUser(input: NewUserInput): Promise<UserRow> {
  const rows = await sql`
    INSERT INTO users (name, username, email, password_hash, is_admin)
    VALUES (${input.name}, ${input.username}, ${input.email}, ${input.passwordHash}, ${input.isAdmin ?? false})
    RETURNING *`;
  return mapUser(rows[0]);
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** För inloggning: returnerar hashen tillsammans med grunddata (annars aldrig exponerad). */
export async function getUserAuthByEmail(
  email: string,
): Promise<{ user: UserRow; passwordHash: string } | null> {
  const rows = await sql`SELECT * FROM users WHERE lower(email) = lower(${email})`;
  if (!rows[0]) return null;
  return { user: mapUser(rows[0]), passwordHash: rows[0].password_hash as string };
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const rows = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  return rows[0] ? (rows[0].id as string) : null;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  // Byt lösenord OCH revokera alla sessioner (i en transaktion).
  await sql.transaction([
    sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${userId}`,
    sql`DELETE FROM sessions WHERE user_id = ${userId}`,
  ]);
}

/** Slår upp en giltig (ej utgången) session och dess användare via token-hash. */
export async function getUserBySessionTokenHash(tokenHash: string): Promise<UserRow | null> {
  const rows = await sql`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  userAgent: string | null,
): Promise<void> {
  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()}, ${userAgent})`;
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

// --- Lösenordsåterställning ---

export async function createPasswordReset(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})`;
}

export async function getPasswordReset(
  tokenHash: string,
): Promise<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null } | null> {
  const rows = await sql`SELECT * FROM password_reset_tokens WHERE token_hash = ${tokenHash}`;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    userId: rows[0].user_id,
    expiresAt: toDate(rows[0].expires_at),
    usedAt: rows[0].used_at ? toDate(rows[0].used_at) : null,
  };
}

export async function markPasswordResetUsed(id: string): Promise<void> {
  await sql`UPDATE password_reset_tokens SET used_at = now() WHERE id = ${id}`;
}
