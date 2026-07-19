"use server";

import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import {
  hashPassword,
  verifyPassword,
  setUserSession,
  clearUserSession,
} from "@/lib/auth";
import {
  createUser,
  getUserAuthByEmail,
  getUserIdByEmail,
  updateUserPassword,
  createPasswordReset,
  getPasswordReset,
  markPasswordResetUsed,
} from "@/lib/queries";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export type AuthState = { error?: string; ok?: boolean } | undefined;

// Generiska meddelanden – läcker inte om ett konto finns eller ej (vibe-security).
const GENERIC_LOGIN_ERROR = "Fel e-post eller lösenord.";
const RATE_LIMITED = "För många försök. Vänta en stund och försök igen.";

function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

// Riktig dummy-hash (skapas lazily) så inloggning tar lika lång tid även utan träff
// → ingen user-enumeration via timing.
let dummyHashCache: string | null = null;
async function dummyHash(): Promise<string> {
  if (!dummyHashCache) dummyHashCache = await hashPassword("timing-guard-not-a-real-password");
  return dummyHashCache;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Namnet måste vara minst 2 tecken.").max(40),
  username: z
    .string()
    .trim()
    .min(3, "Användarnamnet måste vara minst 3 tecken.")
    .max(20, "Användarnamnet får vara högst 20 tecken.")
    .regex(/^[a-zA-Z0-9_]+$/, "Endast bokstäver, siffror och understreck."),
  email: z.email("Ogiltig e-postadress.").max(120),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken.").max(200),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 10, 60_000).ok) return { error: RATE_LIMITED };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter." };
  }

  const { name, username, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const user = await createUser({ name, username, email, passwordHash });
    userId = user.id;
  } catch (err) {
    // Unik-constraint: skilj på användarnamn (måste kommuniceras) och e-post.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("users_username_uidx")) return { error: "Användarnamnet är upptaget." };
    if (msg.includes("users_email_uidx")) return { error: "E-postadressen är redan registrerad." };
    console.error("[register] oväntat fel:", err);
    return { error: "Något gick fel. Försök igen." };
  }

  await setUserSession(userId);
  redirect(safeNext(formData.get("next")));
}

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 10, 60_000).ok) return { error: RATE_LIMITED };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  const found = await getUserAuthByEmail(parsed.data.email);
  // Kör alltid en verifiering (även utan träff) för att undvika user-enumeration via timing.
  const ok = await verifyPassword(parsed.data.password, found?.passwordHash ?? (await dummyHash()));
  if (!found || !ok) return { error: GENERIC_LOGIN_ERROR };

  await setUserSession(found.user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await clearUserSession();
  redirect("/");
}

// --- Lösenordsåterställning ---

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_DONE = "Om adressen finns hos oss har vi skickat en återställningslänk.";

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!rateLimit(`pwreset:${ip}`, 5, 60_000).ok) return { error: RATE_LIMITED };

  const email = z.email().safeParse(formData.get("email"));
  // Svara alltid likadant, oavsett om adressen finns (undvik att läcka existens).
  if (!email.success) return { ok: true, error: undefined };

  const userId = await getUserIdByEmail(email.data);
  if (userId) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await createPasswordReset(userId, hashToken(token), expiresAt);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = `${base}/reset-password?token=${token}`;
    await sendEmail({
      to: email.data,
      subject: "Återställ ditt lösenord",
      text: `Klicka för att välja ett nytt lösenord (giltig i 1 timme):\n${link}`,
      html: `<p>Klicka för att välja ett nytt lösenord (giltig i 1 timme):</p><p><a href="${link}">${link}</a></p>`,
    });
  }
  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken.").max(200),
});

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!rateLimit(`pwreset-submit:${ip}`, 10, 60_000).ok) return { error: RATE_LIMITED };

  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ogiltig länk." };

  const record = await getPasswordReset(hashToken(parsed.data.token));
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return { error: "Länken är ogiltig eller har gått ut. Begär en ny." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await updateUserPassword(record.userId, passwordHash);
  await markPasswordResetUsed(record.id);
  redirect("/login?reset=1");
}
