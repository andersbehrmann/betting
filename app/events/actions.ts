"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  getMembership,
  createMembership,
  participantNameExists,
  setMembershipCheckoutSession,
} from "@/lib/queries";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

type Result = { ok: true } | { ok: false; error: string };
type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/** Visningsnamn som är unikt inom eventet. */
async function uniqueDisplayName(eventId: string, name: string, username: string): Promise<string> {
  return (await participantNameExists(eventId, name)) ? `${name} (${username})` : name;
}

/**
 * Ansluter en inloggad användare till ett GRATIS event.
 * Avgiftsbelagda event går via startCheckout (Stripe).
 */
export async function joinPlatformEvent(eventId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  if (event.status !== "open") return { ok: false, error: "Eventet tar inte emot nya deltagare." };

  const existing = await getMembership(eventId, user.id);
  if (existing) return { ok: true };

  if (event.joinFeeCents > 0) {
    return { ok: false, error: "Det här eventet kräver betalning." };
  }

  const name = await uniqueDisplayName(eventId, user.name, user.username);
  await createMembership(eventId, user.id, name, "none");
  revalidatePath(`/events/${event.slug}`);
  return { ok: true };
}

/**
 * Startar en Stripe Checkout för anslutningsavgiften och returnerar betal-URL:en.
 *
 * Beloppet hämtas ALLTID från eventet server-side – aldrig från klienten.
 * Medlemskapet skapas som 'pending' och flippas till 'paid' först av webhooken,
 * så en avbruten eller manipulerad retur aldrig ger tillträde.
 */
export async function startCheckout(eventId: string): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };
  if (!isStripeConfigured()) {
    return { ok: false, error: "Betalning är inte konfigurerad ännu. Hör av dig till admin." };
  }

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  if (event.status !== "open") return { ok: false, error: "Eventet tar inte emot nya deltagare." };
  if (event.joinFeeCents <= 0) return { ok: false, error: "Eventet är gratis – ingen betalning behövs." };

  // Medlemskap i väntläge (skapas en gång, återanvänds vid nytt försök).
  let membership = await getMembership(eventId, user.id);
  if (membership?.joinFeeStatus === "paid") return { ok: false, error: "Du har redan betalat." };
  if (!membership) {
    const name = await uniqueDisplayName(eventId, user.name, user.username);
    membership = await createMembership(eventId, user.id, name, "pending");
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3007";
  const eventUrl = `${base}/events/${event.slug}`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      // Belopp och valuta kommer från eventet – aldrig från klienten.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: event.currency.toLowerCase(),
            unit_amount: event.joinFeeCents,
            product_data: { name: `Anslutning: ${event.name}` },
          },
        },
      ],
      customer_email: user.email,
      client_reference_id: membership.id,
      metadata: { participantId: membership.id, eventId: event.id, userId: user.id },
      success_url: `${eventUrl}?betalning=klar`,
      cancel_url: `${eventUrl}?betalning=avbruten`,
    });

    if (!session.url) return { ok: false, error: "Kunde inte starta betalningen." };
    await setMembershipCheckoutSession(membership.id, session.id);
    return { ok: true, url: session.url };
  } catch (err) {
    // Detaljer i serverloggen, generiskt fel till användaren.
    console.error("[startCheckout] Stripe-fel:", err);
    return { ok: false, error: "Kunde inte starta betalningen. Försök igen." };
  }
}
