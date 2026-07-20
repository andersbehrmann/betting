// Stripe webhook: enda stället där en anslutningsavgift markeras som betald.
// Ingen sessionsauth här – signaturen ÄR autentiseringen.

import type Stripe from "stripe";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import {
  recordStripeEvent,
  forgetStripeEvent,
  getMembershipByCheckoutSession,
  markMembershipPaid,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Saknar stripe-signature", { status: 400 });

  // RÅ body krävs – JSON-parsning ändrar bytes och gör signaturen ogiltig.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      getWebhookSecret(),
    );
  } catch (err) {
    console.error("[stripe webhook] Signaturverifiering misslyckades:", err);
    return new Response("Ogiltig signatur", { status: 400 });
  }

  // Idempotens: Stripe kan leverera samma event flera gånger. Vi agerar bara
  // när raden faktiskt nyskapades.
  let isFirstDelivery: boolean;
  try {
    isFirstDelivery = await recordStripeEvent(event.id, event.type);
  } catch (err) {
    console.error("[stripe webhook] Kunde inte skriva idempotens-rad:", err);
    return new Response("Databasfel", { status: 500 });
  }
  if (!isFirstDelivery) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status === "paid") {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        // Vi satte själva metadata/client_reference_id; fall tillbaka på
        // sessions-id:t vi lagrade på medlemskapet.
        const participantId =
          session.metadata?.participantId ?? session.client_reference_id ?? null;

        if (participantId) {
          await markMembershipPaid(participantId, paymentIntentId);
        } else {
          const membership = await getMembershipByCheckoutSession(session.id);
          if (membership) await markMembershipPaid(membership.id, paymentIntentId);
          else console.error("[stripe webhook] Hittade inget medlemskap för session", session.id);
        }
      }
    }
  } catch (err) {
    // Släpp idempotens-raden igen, annars skulle Stripes omförsök hoppas över
    // och betalningen aldrig registreras. Sidoeffekten (markMembershipPaid) är
    // idempotent, så en extra körning är ofarlig.
    console.error("[stripe webhook] Fel vid hantering av", event.type, err);
    await forgetStripeEvent(event.id).catch(() => {});
    return new Response("Fel vid hantering", { status: 500 });
  }

  return Response.json({ received: true });
}
