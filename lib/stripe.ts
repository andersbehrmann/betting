// Stripe-klient för anslutningsavgiften. Endast server-side – hemligheten får
// aldrig nå klienten.
//
// Klienten skapas LAZILY (samma skäl som Neon-klienten i lib/db.ts): nycklarna
// läses först när ett anrop faktiskt sker, så `next build` fungerar även innan
// STRIPE_SECRET_KEY är satt.

import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY saknas – sätt den i .env.local eller i Vercel.");
  }
  client = new Stripe(key);
  return client;
}

/** True om Stripe är konfigurerat (används för att visa vettiga fel i UI). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET saknas – krävs för att verifiera webhooks.");
  }
  return secret;
}
