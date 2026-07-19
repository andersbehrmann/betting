"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearUserSession, isAdmin, getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  getGames,
  getGameById,
  updateEventSettings,
  createPlatformEvent,
  setEventStatus,
  setBettingOpen as qSetBettingOpen,
  setEventFlag,
  setGameActive,
  setGameBettingOpen,
  createCustomGame,
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
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

// --- Auth ---
// Inloggning sker nu via /login (konto + lösenord). Admin = users.is_admin.

export async function adminLogout(): Promise<void> {
  await clearUserSession();
  redirect("/");
}

// --- Plattforms-event (generiska betting-/poäng-event) ---

const createEventSchema = z.object({
  name: z.string().trim().min(2, "Namnet måste vara minst 2 tecken.").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Slug måste vara minst 2 tecken.")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug: endast små bokstäver, siffror och bindestreck."),
  eventType: z.enum(["betting", "points"]),
  joinFeeKr: z.number().min(0).max(100000),
  currency: z.string().trim().min(1).max(8),
  description: z.string().trim().max(500).nullable(),
  status: z.enum(["draft", "open", "closed"]),
});

export async function createEventAction(
  input: z.infer<typeof createEventSchema>,
): Promise<Result & { slug?: string }> {
  const g = await guard();
  if (g) return g;
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const user = await getCurrentUser();

  try {
    await createPlatformEvent({
      name: d.name,
      slug: d.slug,
      eventType: d.eventType,
      joinFeeCents: Math.round(d.joinFeeKr * 100),
      currency: d.currency,
      description: d.description && d.description.length > 0 ? d.description : null,
      status: d.status,
      createdBy: user?.id ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("events_slug_key") || msg.includes("duplicate")) {
      return { ok: false, error: "Slug är redan tagen. Välj en annan." };
    }
    console.error("[createEventAction]", err);
    return { ok: false, error: "Kunde inte skapa eventet." };
  }
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { ok: true, slug: d.slug };
}

export async function setEventStatusAction(
  eventId: string,
  status: "draft" | "open" | "closed",
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await setEventStatus(eventId, status);
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { ok: true };
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

export async function saveEventSettings(eventId: string, raw: SettingsInputRaw): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const settings = toEventSettings(parsed.data);

  const existing = await getEventById(eventId);
  if (!existing) return { ok: false, error: "Eventet finns inte." };
  await updateEventSettings(existing.id, settings);
  await insertAudit(existing.id, "admin", "update_settings", null, null);
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

export async function setBettingOpen(eventId: string, open: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  await qSetBettingOpen(eventId, open);
  await insertAudit(eventId, "admin", open ? "open_betting" : "close_betting", null, null);
  revalidateAdmin();
  return { ok: true };
}

export async function toggleEventFlag(
  eventId: string,
  flag: "leaderboard_visible" | "bets_public",
  value: boolean,
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  await setEventFlag(eventId, flag, value);
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

/** Öppnar/stänger betting för ett enskilt spel (oberoende av globalt tipsstopp). */
export async function toggleGameBetting(gameId: string, open: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const game = await getGameById(gameId);
  if (!game) return { ok: false, error: "Spel saknas." };
  await setGameBettingOpen(gameId, open);
  await insertAudit(game.eventId, "admin", open ? "open_game_betting" : "close_game_betting", gameId, null);
  revalidateAdmin();
  return { ok: true };
}

const customGameSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).nullable(),
  stake: z.number().min(0).max(100000),
  bettingOpen: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(12),
});
export type CustomGameInputRaw = z.input<typeof customGameSchema>;

/** Skapar ett eget flervalsspel som kan läggas till när som helst under kvällen. */
export async function addCustomGame(eventId: string, raw: CustomGameInputRaw): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = customGameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ogiltigt spel (minst 2 svarsalternativ krävs)." };
  }
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };

  const data = parsed.data;
  const options = data.options.map((label, i) => ({ value: `o${i}`, label }));
  const gameKey = `custom_${randomBytes(4).toString("hex")}`;

  const id = await createCustomGame(event.id, gameKey, {
    title: data.title,
    description: data.description || null,
    stake: data.stake,
    options,
    bettingOpen: data.bettingOpen,
  });
  await insertAudit(event.id, "admin", "add_custom_game", id, { title: data.title });
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
export async function settlePackage(eventId: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
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

export async function setPaymentStatus(
  eventId: string,
  participantId: string,
  status: PaymentStatus,
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  await qSetPaymentStatus(participantId, status);
  await insertAudit(eventId, "admin", "set_payment", null, { participantId, status });
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
