// Neon HTTP-klient för app-runtime (server actions / server components).
// Endast server-side – importera aldrig i klientkomponenter.
//
// Klienten skapas LAZILY: DATABASE_URL läses först när en fråga faktiskt körs
// (vid request), inte vid import. Det gör att `next build` kan samla sidor även
// innan miljövariabler finns satta (t.ex. första Vercel-bygget).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL saknas – sätt den i .env.local eller i Vercel.");
  }
  client = neon(url);
  return client;
}

// Proxy så att `sql\`...\``, `sql.query(...)` och `sql.transaction(...)` alla
// initierar klienten vid första användning.
export const sql = new Proxy(function () {} as unknown as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args: unknown[]) {
    // Tagged template: sql`...` → getClient()(strings, ...values)
    return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
}) as NeonQueryFunction<false, false>;

// Neon returnerar numeric som string (för precision). Hjälpare för säker parsning.
export function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export function toDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
