"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventById,
  getMembership,
  createMembership,
  participantNameExists,
  setMembershipCheckoutSession,
  createProposal,
  getAdminUsers,
} from "@/lib/queries";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  resolveParticipant,
  hasPaidAccess,
  rememberParticipantOnDevice,
} from "@/lib/participants";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

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
  if (existing) {
    await rememberParticipantOnDevice(existing.id);
    return { ok: true };
  }

  if (event.joinFeeCents > 0) {
    return { ok: false, error: "Det här eventet kräver betalning." };
  }

  const name = await uniqueDisplayName(eventId, user.name, user.username);
  const membership = await createMembership(eventId, user.id, name, "none");
  // Reserv om sessionen försvinner – annars är man utelåst från sitt medlemskap.
  await rememberParticipantOnDevice(membership.id);
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

// --- Spelförslag från deltagare ---

const proposalSchema = z.object({
  title: z.string().trim().min(3, "Titeln måste vara minst 3 tecken.").max(120),
  description: z.string().trim().max(300).nullable(),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2, "Ange minst 2 svarsalternativ.")
    .max(12, "Högst 12 svarsalternativ."),
});

export type ProposalInput = z.input<typeof proposalSchema>;

/**
 * Deltagare föreslår ett nytt spel. Förslaget publiceras aldrig direkt – admin
 * granskar och skapar i så fall ett utkast som hen finjusterar och öppnar.
 */
export async function proposeGame(eventId: string, raw: ProposalInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Du måste vara inloggad." };

  const ip = await clientIp();
  if (!rateLimit(`propose:${user.id}:${ip}`, 5, 10 * 60_000).ok) {
    return { ok: false, error: "Du har skickat många förslag. Försök igen om en stund." };
  }

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  if (event.status !== "open") return { ok: false, error: "Eventet är inte öppet." };

  // Bara deltagare i eventet får föreslå – och avgiften måste vara betald.
  const participant = await resolveParticipant(event.id);
  if (!participant) return { ok: false, error: "Bara deltagare kan föreslå spel." };
  if (!hasPaidAccess(event, participant)) {
    return { ok: false, error: "Anslutningsavgiften är inte betald." };
  }

  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ogiltigt förslag." };
  }
  const data = parsed.data;

  await createProposal({
    eventId: event.id,
    proposedBy: user.id,
    title: data.title,
    description: data.description || null,
    suggestedOptions: data.options.map((label, i) => ({ value: `o${i}`, label })),
  });

  // Notera admin. Får inte fälla själva förslaget om mejlet strular.
  try {
    const admins = await getAdminUsers();
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3007";
    const link = `${base}/admin/events/${event.id}/proposals`;
    await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.email,
          subject: `Nytt spelförslag: ${data.title}`,
          text: `${user.name} föreslog "${data.title}" i ${event.name}.\n\nGranska: ${link}`,
          html: `<p><strong>${user.name}</strong> föreslog ”${data.title}” i ${event.name}.</p><p><a href="${link}">Granska förslaget</a></p>`,
        }),
      ),
    );
  } catch (err) {
    console.error("[proposeGame] Kunde inte notifiera admin:", err);
  }

  revalidatePath(`/admin/events/${event.id}/proposals`);
  return { ok: true };
}
