"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  setAdminSession,
  clearAdminSession,
  isAdmin,
} from "@/lib/auth";
import {
  getActiveEvent,
  getGames,
  getGameById,
  updateEventSettings,
  createEvent,
  setBettingOpen as qSetBettingOpen,
  setEventFlag,
  setGameActive,
  setGameResult,
  setGameStatus,
  replacePlayers,
  replaceGameWinners,
  setPaymentStatus as qSetPaymentStatus,
  setAdminNote as qSetAdminNote,
  insertAudit,
  getBetsForGame,
  type EventSettingsInput,
} from "@/lib/queries";
import { recalcGame } from "@/lib/recalc";
import { fromDatetimeLocal } from "@/lib/time";
import { GAME_DEFINITIONS } from "@/lib/scoring/games";
import { assemblePackageResult } from "@/lib/scoring/evaluate";
import { PACKAGE_GAME_KEY } from "@/lib/scoring/types";
import type { GameResult, PackageResult, ScoreAnswer } from "@/lib/scoring/types";
import type { PaymentStatus } from "@/lib/types";
import { potFor, round2 } from "@/lib/scoring/payouts";

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<Result | null> {
  return (await isAdmin()) ? null : { ok: false, error: "Ej behörig (admin krävs)." };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/results");
  revalidatePath("/");
  revalidatePath("/my-bets");
  revalidatePath("/leaderboard");
}

// --- Auth ---

export async function adminLogin(password: string): Promise<Result> {
  if (!checkAdminPassword(password)) {
    return { ok: false, error: "Fel lösenord." };
  }
  await setAdminSession();
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

// --- Event / inställningar ---

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teamOne: z.string().trim().min(1).max(60),
  teamTwo: z.string().trim().min(1).max(60),
  matchStart: z.string().min(1),
  bettingDeadline: z.string().min(1),
  currency: z.string().trim().min(1).max(8),
  defaultStake: z.number().min(0).max(100000),
  jackpotStake: z.number().min(0).max(100000),
  starPlayerName: z.string().trim().max(80).nullable(),
  starListenTarget: z.string().trim().max(80).nullable(),
  countStaffCards: z.boolean(),
  closestResultMode: z.enum(["nearest", "no_winner"]),
  packageTiebreakExact: z.boolean(),
});

export type SettingsInputRaw = z.input<typeof settingsSchema>;

function toEventSettings(raw: z.infer<typeof settingsSchema>): EventSettingsInput {
  return {
    name: raw.name,
    teamOne: raw.teamOne,
    teamTwo: raw.teamTwo,
    matchStart: fromDatetimeLocal(raw.matchStart),
    bettingDeadline: fromDatetimeLocal(raw.bettingDeadline),
    currency: raw.currency,
    defaultStake: raw.defaultStake,
    jackpotStake: raw.jackpotStake,
    starPlayerName: raw.starPlayerName || null,
    starListenTarget: raw.starListenTarget || null,
    countStaffCards: raw.countStaffCards,
    closestResultMode: raw.closestResultMode,
    packageTiebreakExact: raw.packageTiebreakExact,
  };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "event"
  );
}

/** Skapar de 12 spelen + matchpaketet för ett nytt event. */
async function createGamesForEvent(eventId: string, defaultStake: number, jackpotStake: number) {
  // Utförs via queries – en enkel loop (körs bara vid event-skapande).
  const { sql } = await import("@/lib/db");
  for (const def of GAME_DEFINITIONS) {
    await sql`
      INSERT INTO games (event_id, game_key, title, description, stake, is_jackpot, active, sort_order, status)
      VALUES (${eventId}, ${def.key}, ${def.title}, ${def.description ?? null},
              ${def.isJackpot ? jackpotStake : defaultStake}, ${def.isJackpot}, true, ${def.sortOrder}, 'open')`;
  }
}

export async function saveEventSettings(raw: SettingsInputRaw): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const settings = toEventSettings(parsed.data);

  const existing = await getActiveEvent();
  if (existing) {
    await updateEventSettings(existing.id, settings);
    await insertAudit(existing.id, "admin", "update_settings", null, null);
  } else {
    const id = await createEvent({ ...settings, slug: slugify(settings.name) });
    await createGamesForEvent(id, settings.defaultStake, settings.jackpotStake);
    await insertAudit(id, "admin", "create_event", null, null);
  }
  revalidateAdmin();
  return { ok: true };
}

const playersSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(60), team: z.union([z.literal(1), z.literal(2)]) }))
  .max(60);

export async function savePlayers(
  eventId: string,
  players: { name: string; team: 1 | 2 }[],
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = playersSchema.safeParse(players);
  if (!parsed.success) return { ok: false, error: "Ogiltig spelarlista." };
  await replacePlayers(eventId, parsed.data);
  await insertAudit(eventId, "admin", "update_players", null, { count: parsed.data.length });
  revalidateAdmin();
  return { ok: true };
}

export async function setBettingOpen(open: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getActiveEvent();
  if (!event) return { ok: false, error: "Inget event." };
  await qSetBettingOpen(event.id, open);
  await insertAudit(event.id, "admin", open ? "open_betting" : "close_betting", null, null);
  revalidateAdmin();
  return { ok: true };
}

export async function toggleEventFlag(
  flag: "leaderboard_visible" | "bets_public",
  value: boolean,
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getActiveEvent();
  if (!event) return { ok: false, error: "Inget event." };
  await setEventFlag(event.id, flag, value);
  revalidateAdmin();
  return { ok: true };
}

export async function toggleGame(gameId: string, active: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await setGameActive(gameId, active);
  revalidateAdmin();
  return { ok: true };
}

// --- Facit & vinnare ---

const scoreSchema = z.object({ home: z.number().int().min(0).max(30), away: z.number().int().min(0).max(30) });
const optionResultSchema = z.object({ value: z.string().min(1).max(64) });

/** Sparar facit för ett spel, markerar avgjort och räknar om vinnare. */
export async function saveFacit(gameId: string, rawResult: unknown): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const game = await getGameById(gameId);
  if (!game) return { ok: false, error: "Spel saknas." };

  let result: GameResult;
  if (game.gameKey === PACKAGE_GAME_KEY) {
    return { ok: false, error: "Matchpaketets facit byggs från de ordinarie spelen." };
  } else if (game.gameKey === "result_90") {
    const p = scoreSchema.safeParse(rawResult);
    if (!p.success) return { ok: false, error: "Ogiltigt resultat." };
    result = p.data as ScoreAnswer;
  } else {
    const p = optionResultSchema.safeParse(rawResult);
    if (!p.success) return { ok: false, error: "Välj ett facit-alternativ." };
    result = p.data;
  }

  await setGameResult(gameId, result);
  await setGameStatus(gameId, "settled", true);
  await insertAudit(game.eventId, "admin", "set_facit", gameId, { result });
  await recalcGame(gameId);
  revalidateAdmin();
  return { ok: true };
}

/** Bygger matchpaketets facit från de ordinarie spelens facit och räknar om. */
export async function settlePackage(): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getActiveEvent();
  if (!event) return { ok: false, error: "Inget event." };
  const games = await getGames(event.id);
  const pkg = games.find((x) => x.gameKey === PACKAGE_GAME_KEY);
  if (!pkg) return { ok: false, error: "Matchpaketet saknas." };

  const ordinaryResults: Partial<Record<string, GameResult>> = {};
  for (const key of ["world_champion", "result_90", "first_scorer", "extra_time"]) {
    const gme = games.find((x) => x.gameKey === key);
    if (gme?.resultData != null) ordinaryResults[key] = gme.resultData;
  }
  const result: PackageResult = assemblePackageResult(ordinaryResults, event.packageTiebreakExact);

  await setGameResult(pkg.id, result);
  await setGameStatus(pkg.id, "settled", true);
  await insertAudit(event.id, "admin", "settle_package", pkg.id, { result });
  await recalcGame(pkg.id);
  revalidateAdmin();
  return { ok: true };
}

/** Återöppnar ett spel för korrigering (behåller facit men markerar ej avgjort). */
export async function reopenGame(gameId: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const game = await getGameById(gameId);
  if (!game) return { ok: false, error: "Spel saknas." };
  await setGameStatus(gameId, "awaiting_result", false);
  await insertAudit(game.eventId, "admin", "reopen_game", gameId, null);
  revalidateAdmin();
  return { ok: true };
}

/** Rensar facit och vinnare helt. */
export async function clearFacit(gameId: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const game = await getGameById(gameId);
  if (!game) return { ok: false, error: "Spel saknas." };
  await setGameResult(gameId, null);
  await setGameStatus(gameId, "closed", false);
  await replaceGameWinners(gameId, []);
  await insertAudit(game.eventId, "admin", "clear_facit", gameId, null);
  revalidateAdmin();
  return { ok: true };
}

/** Manuell justering: sätter vinnare för ett spel manuellt (potten delas lika). */
export async function setManualWinners(gameId: string, participantIds: string[]): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const game = await getGameById(gameId);
  if (!game) return { ok: false, error: "Spel saknas." };
  const bets = await getBetsForGame(gameId);
  const pot = potFor(bets.length, game.stake);
  const per = participantIds.length ? round2(pot / participantIds.length) : 0;
  await replaceGameWinners(
    gameId,
    participantIds.map((pid) => ({ participantId: pid, payout: per, isManual: true })),
  );
  await setGameStatus(gameId, "settled", true);
  await insertAudit(game.eventId, "admin", "manual_winners", gameId, { participantIds, per });
  revalidateAdmin();
  return { ok: true };
}

// --- Deltagare / betalning ---

export async function setPaymentStatus(participantId: string, status: PaymentStatus): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await qSetPaymentStatus(participantId, status);
  const event = await getActiveEvent();
  if (event) await insertAudit(event.id, "admin", "set_payment", null, { participantId, status });
  revalidateAdmin();
  return { ok: true };
}

export async function setAdminNote(participantId: string, note: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await qSetAdminNote(participantId, note.trim() || null);
  revalidateAdmin();
  return { ok: true };
}
