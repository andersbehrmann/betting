// EN väg att lösa upp "vem är jag i det här eventet", oavsett hur man gick med.
// Server-only – används av spel-/mina tips-sidorna och av submitBets.

import "server-only";
import { getCurrentUser, getParticipantToken } from "./auth";
import { getMembership, getParticipantByToken } from "./queries";
import type { ParticipantRow } from "./types";

/**
 * Deltagaren för ett event, eller null.
 *
 * 1. Inloggat konto med medlemskap (participants.user_id) har företräde.
 * 2. Annars legacy: anonym deltagar-token i cookie – måste tillhöra just detta event.
 *
 * Returnerad rad är alltid garanterat kopplad till `eventId`.
 */
export async function resolveParticipant(eventId: string): Promise<ParticipantRow | null> {
  const user = await getCurrentUser();
  if (user) {
    const membership = await getMembership(eventId, user.id);
    if (membership) return membership;
  }

  const token = await getParticipantToken();
  if (token) {
    const p = await getParticipantByToken(token);
    if (p && p.eventId === eventId) return p;
  }

  return null;
}
