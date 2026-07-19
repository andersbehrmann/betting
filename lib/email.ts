// Tunn e-postklient mot Resend REST API (ingen extra dep – använder fetch).
// Om RESEND_API_KEY saknas loggas meddelandet istället (dev-fallback) så att flöden
// fungerar lokalt utan e-postkonfiguration.

import "server-only";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY saknas – skickar inte. Skulle skickat till ${to}: ${subject}`,
    );
    console.warn(`[email] text: ${text ?? html}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      // Logga serverdetaljer, men låt inte kalla-sidan läcka dem vidare.
      console.error(`[email] Resend svarade ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[email] Kunde inte nå Resend:", err);
  }
}
