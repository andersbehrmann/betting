"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  createFriendLeaderboard,
  getFriendLeaderboardByInviteCode,
  addFriendLeaderboardMember,
  isFriendLeaderboardMember,
} from "@/lib/queries";
import { resolveParticipant, hasPaidAccess } from "@/lib/participants";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { EventRow, UserRow } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

const nameSchema = z
  .string()
  .trim()
  .min(2, "Namnet måste vara minst 2 tecken.")
  .max(60, "Namnet får vara högst 60 tecken.");

/** Kort, lättdelad kod utan lättförväxlade tecken (0/O, 1/I). */
function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type ParticipantCtx =
  | { ok: false; error: string }
  | { ok: true; user: UserRow; event: EventRow };

/** Bara deltagare i eventet får skapa/gå med i delligor. */
async function requireEventParticipant(eventId: string): Promise<ParticipantCtx> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };

  const participant = await resolveParticipant(event.id);
  if (!participant) {
    return { ok: false, error: "Bara deltagare i eventet kan använda kompisligor." };
  }
  if (!hasPaidAccess(event, participant)) {
    return { ok: false, error: "Anslutningsavgiften är inte betald." };
  }
  return { ok: true, user, event };
}

export async function createFriendGroup(eventId: string, rawName: string): Promise<Result> {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const ctx = await requireEventParticipant(eventId);
  if (!ctx.ok) return ctx;

  const ip = await clientIp();
  if (!rateLimit(`friendlb:${ctx.user.id}:${ip}`, 10, 10 * 60_000).ok) {
    return { ok: false, error: "För många försök. Vänta en stund." };
  }

  await createFriendLeaderboard(ctx.event.id, ctx.user.id, parsed.data, makeInviteCode());
  revalidatePath(`/events/${ctx.event.slug}/friends`);
  return { ok: true };
}

/**
 * Gå med via inbjudningskod. Koden är hemligheten – men man måste ändå vara
 * deltagare i eventet, så en läckt kod inte ger utomstående insyn.
 */
export async function joinFriendGroup(rawCode: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };

  const ip = await clientIp();
  if (!rateLimit(`friendjoin:${ip}`, 15, 10 * 60_000).ok) {
    return { ok: false, error: "För många försök. Vänta en stund." };
  }

  const code = rawCode.trim().toUpperCase();
  if (code.length < 4) return { ok: false, error: "Ogiltig kod." };

  const lb = await getFriendLeaderboardByInviteCode(code);
  // Samma svar oavsett om koden finns eller ej – läck inte vilka koder som är giltiga.
  if (!lb) return { ok: false, error: "Ingen liga hittades med den koden." };

  const ctx = await requireEventParticipant(lb.eventId);
  if (!ctx.ok) return ctx;

  if (await isFriendLeaderboardMember(lb.id, user.id)) return { ok: true };

  await addFriendLeaderboardMember(lb.id, user.id);
  revalidatePath(`/events/${ctx.event.slug}/friends`);
  return { ok: true };
}
