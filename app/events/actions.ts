"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  getMembership,
  createMembership,
  participantNameExists,
} from "@/lib/queries";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Ansluter en inloggad användare till ett event (skapar medlemskap).
 * Fas 2: endast gratis-event slutförs här. Avgiftsbelagda event hanteras i Fas 3 (Stripe).
 */
export async function joinPlatformEvent(eventId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  if (event.status !== "open") return { ok: false, error: "Eventet tar inte emot nya deltagare." };

  // Redan medlem? Idempotent.
  const existing = await getMembership(eventId, user.id);
  if (existing) return { ok: true };

  if (event.joinFeeCents > 0) {
    return { ok: false, error: "Betalning via Stripe aktiveras i nästa steg (Fas 3)." };
  }

  // Visningsnamn måste vara unikt per event (case-insensitive). Fall tillbaka på användarnamn.
  let name = user.name;
  if (await participantNameExists(eventId, name)) name = `${user.name} (${user.username})`;

  await createMembership(eventId, user.id, name, "none");
  revalidatePath(`/events`);
  return { ok: true };
}
