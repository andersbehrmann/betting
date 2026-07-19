// Neon HTTP-klient för app-runtime (server actions / route handlers).
// Endast server-side – importera aldrig i klientkomponenter.

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL saknas – sätt den i .env.local eller i Vercel.");
}

export const sql = neon(url);

// Neon returnerar numeric som string (för precision). Hjälpare för säker parsning.
export function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export function toDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
