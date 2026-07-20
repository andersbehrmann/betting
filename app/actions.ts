"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getEventById,
  getGames,
  participantNameExists,
  createParticipant,
  createMembership,
  getMembership,
  saveBets,
  getBetsForParticipant,
  type BetInput,
} from "@/lib/queries";
import { setParticipantToken, getCurrentUser } from "@/lib/auth";
import { resolveParticipant, hasPaidAccess } from "@/lib/participants";
import { isGameBettable, isGloballyOpen } from "@/lib/betting";
import { getGameDefinition } from "@/lib/scoring/games";
import { PACKAGE_GAME_KEY } from "@/lib/scoring/types";
import type { Answer } from "@/lib/scoring/types";
import type { EventRow } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function isLocked(event: EventRow): boolean {
  return !isGloballyOpen(event);
}

// --- Gå med (skapa deltagare) ---

const nameSchema = z
  .string()
  .trim()
  .min(2, "Namnet måste vara minst 2 tecken.")
  .max(40, "Namnet får vara högst 40 tecken.");

export async function joinEvent(eventId: string, rawName: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = parsed.data;

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  if (event.status !== "open") {
    return { ok: false, error: "Eventet tar inte emot nya deltagare." };
  }
  if (isLocked(event)) return { ok: false, error: "Tipsningen är stängd." };

  const user = await getCurrentUser();

  // Redan medlem via konto? Då är man med – idempotent.
  if (user) {
    const existing = await getMembership(eventId, user.id);
    if (existing) return { ok: true };
  }

  // Avgiftsbelagda event får aldrig anslutas gratis här – de går via eventsidan
  // (konto + betalning). Annars vore hela avgiften kringgåelig.
  if (event.joinFeeCents > 0) {
    return {
      ok: false,
      error: "Det här eventet har en anslutningsavgift – anslut via eventsidan.",
    };
  }

  if (await participantNameExists(eventId, name)) {
    return { ok: false, error: "Namnet är redan taget i det här eventet. Välj ett annat." };
  }

  if (user) {
    // Inloggad → kontobaserat medlemskap (ingen deltagar-cookie behövs).
    await createMembership(eventId, user.id, name, "none");
  } else {
    // Anonym gäst → legacy-token (gratis event, t.ex. en snabb tipskväll).
    const token = randomBytes(16).toString("hex");
    await createParticipant(eventId, name, token);
    await setParticipantToken(token);
  }

  revalidatePath(`/events/${event.slug}/play`);
  return { ok: true };
}

// --- Skicka in tips ---

const scoreSchema = z.object({
  home: z.number().int().min(0).max(30),
  away: z.number().int().min(0).max(30),
});
const optionSchema = z.object({ value: z.string().min(1).max(64) });
const packageSchema = z.object({
  world_champion: z.string().min(1).max(64).optional(),
  result_90: scoreSchema.optional(),
  first_scorer: z.string().min(1).max(64).optional(),
  extra_time: z.string().min(1).max(64).optional(),
});

function validateAnswer(inputKind: string, raw: unknown): Answer | null {
  if (inputKind === "score") {
    const r = scoreSchema.safeParse(raw);
    return r.success ? r.data : null;
  }
  if (inputKind === "package") {
    const r = packageSchema.safeParse(raw);
    if (!r.success) return null;
    // Minst en del ifylld.
    const d = r.data;
    if (!d.world_champion && !d.result_90 && !d.first_scorer && !d.extra_time) return null;
    return d;
  }
  // option / scorer
  const r = optionSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export interface SubmitSelection {
  gameId: string;
  answer: unknown;
}

export async function submitBets(eventId: string, selections: SubmitSelection[]): Promise<ActionResult> {
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };

  // Konto-medlemskap ELLER legacy-token – resolvern garanterar rätt event.
  const participant = await resolveParticipant(event.id);
  if (!participant) return { ok: false, error: "Du är inte deltagare i det här eventet." };
  if (!hasPaidAccess(event, participant)) {
    return { ok: false, error: "Anslutningsavgiften är inte betald." };
  }

  if (!isGloballyOpen(event)) {
    return { ok: false, error: "Tipsningen är stängd – tipsen är låsta." };
  }

  const games = await getGames(event.id);
  const gameById = new Map(games.map((g) => [g.id, g]));
  // Bara spel som tar emot tips just nu får ändras.
  const bettableIds = new Set(games.filter((g) => isGameBettable(g, event)).map((g) => g.id));

  const selectedIds = new Set<string>();
  const validated: BetInput[] = [];

  for (const sel of selections) {
    const game = gameById.get(sel.gameId);
    if (!game) return { ok: false, error: "Ett valt spel finns inte längre." };
    if (!bettableIds.has(game.id)) {
      return { ok: false, error: `Spelet "${game.title}" är stängt för tips.` };
    }
    const def = getGameDefinition(game.gameKey);
    const inputKind = def?.inputKind ?? (game.gameKey === PACKAGE_GAME_KEY ? "package" : "option");
    const answer = validateAnswer(inputKind, sel.answer);
    if (!answer) return { ok: false, error: `Ofullständigt tips i "${game.title}".` };
    selectedIds.add(game.id);
    // Insatsen bestäms server-side utifrån spelet – aldrig från klienten.
    validated.push({ gameId: game.id, answer, stake: game.stake });
  }

  // Ta ENDAST bort tips på spel som fortfarande är öppna och som deltagaren nu valt bort.
  // Tips på stängda/dolda spel bevaras alltid → "allt samlat".
  const existing = await getBetsForParticipant(participant.id);
  const removedGameIds = existing
    .filter((b) => bettableIds.has(b.gameId) && !selectedIds.has(b.gameId))
    .map((b) => b.gameId);

  await saveBets(participant.id, validated, removedGameIds);
  revalidatePath("/events");
  return { ok: true };
}
