// Enkel in-memory rate limiter (sliding window per nyckel).
// OBS: per-process/best-effort. På serverless (flera instanser) delas inte state –
// för hård distribuerad limiting använd Upstash Redis e.d. För denna skala (få
// användare, ett event i taget) räcker detta som skydd mot brute force/spam.

import "server-only";

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Tillåter `limit` anrop per `windowMs` för en given nyckel (t.ex. "login:<ip>").
 * Returnerar ok=false när gränsen passerats.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  // Enkel städning så mappen inte växer obegränsat.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Bäst-möjliga klient-IP från request-headers (bakom Vercel/proxy). */
export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
