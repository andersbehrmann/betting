// Auktorisering i app-lagret. Ingen riktig user-auth – admin via lösenord,
// deltagare via access_token. All kontroll sker server-side.

import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const ADMIN_COOKIE = "admin_session";
const PARTICIPANT_COOKIE = "participant_token";
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET saknas.");
  return s;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function makeAdminToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ADMIN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Kontrollerar admin-lösenordet (timing-safe). */
export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD saknas.");
  return safeEqual(input, expected);
}

/** Sätter admin-sessionscookie efter lyckad inloggning. */
export async function setAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/** True om aktuell request har en giltig admin-session. */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Kastar om inte admin – använd i admin-actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Ej behörig (admin krävs).");
}

// --- Deltagare ---

export async function setParticipantToken(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagar – "återvända på samma enhet"
  });
}

export async function getParticipantToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PARTICIPANT_COOKIE)?.value;
}

export async function clearParticipantToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(PARTICIPANT_COOKIE);
}
