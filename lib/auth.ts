// Auktorisering i app-lagret. Riktiga konton: lösenord (scrypt) + DB-baserade sessions.
// Admin = users.is_admin. Deltagar-token (access_token) behålls för legacy-eventet.
// All kontroll sker server-side.

import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
  createHash,
  type ScryptOptions,
} from "node:crypto";
import {
  getUserBySessionTokenHash,
  createSession,
  deleteSessionByTokenHash,
} from "./queries";
import type { UserRow } from "./types";

// node:crypto scrypt med options (promisify:s typer saknar denna overload).
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey as Buffer),
    );
  });
}

const SESSION_COOKIE = "session";
const PARTICIPANT_COOKIE = "participant_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagar

// --- Lösenordshashning (node:crypto scrypt, ingen extern dep) ---
// Format: scrypt$N$r$p$saltBase64$hashBase64

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = (await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// --- Session-tokens ---

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Skapar en ny session för användaren och sätter sessionscookien. */
export async function setUserSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  let ua: string | null = null;
  try {
    ua = (await headers()).get("user-agent");
  } catch {
    ua = null;
  }
  await createSession(userId, hashToken(token), expiresAt, ua);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Loggar ut: raderar sessionsraden och tömmer cookien. */
export async function clearUserSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByTokenHash(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

/**
 * Aktuell inloggad användare (eller null). Memoiseras per render-pass med React cache
 * så vi bara gör en session-uppslagning per request.
 */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionTokenHash(hashToken(token));
});

/** Kastar om ingen är inloggad – använd i server actions som kräver konto. */
export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Ej inloggad.");
  return user;
}

/** True om aktuell request har en giltig admin-session. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.isAdmin === true;
}

/** Kastar om inte admin – använd i admin-actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Ej behörig (admin krävs).");
}

// --- Deltagare (legacy-token, behålls för det seedade fotbollseventet) ---

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
