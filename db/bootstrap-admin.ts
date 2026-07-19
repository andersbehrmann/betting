// Skapar (eller uppgraderar) en admin-användare. Kan inte göras i SQL eftersom
// lösenordet måste hashas med samma scrypt-schema som appen (lib/auth.ts).
//
// Användning (flaggor eller env):
//   npm run bootstrap-admin -- --email ab@annors.se --name "Anders" --username anders --password "hemligt"
//   ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run bootstrap-admin
//
// Är e-posten redan registrerad sätts is_admin=true och lösenordet uppdateras.

import { scrypt as scryptCb, randomBytes, type ScryptOptions } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, dk) => (err ? reject(err) : resolve(dk as Buffer)));
  });
}

// Måste matcha lib/auth.ts: scrypt$N$r$p$saltB64$hashB64
async function hashPassword(password: string): Promise<string> {
  const N = 16384,
    r = 8,
    p = 1,
    keylen = 64;
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email") ?? process.env.ADMIN_EMAIL;
  const name = arg("--name") ?? process.env.ADMIN_NAME ?? "Admin";
  const username = arg("--username") ?? process.env.ADMIN_USERNAME ?? "admin";
  const password = arg("--password") ?? process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Ange --email och --password (eller ADMIN_EMAIL/ADMIN_PASSWORD i .env.local).",
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas (kontrollera .env.local)");

  const passwordHash = await hashPassword(password);
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const existing = await c.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = lower($1)",
      [email],
    );
    if (existing.rows[0]) {
      await c.query(
        "UPDATE users SET password_hash = $1, is_admin = true, updated_at = now() WHERE id = $2",
        [passwordHash, existing.rows[0].id],
      );
      // Revokera ev. gamla sessioner efter lösenordsbyte.
      await c.query("DELETE FROM sessions WHERE user_id = $1", [existing.rows[0].id]);
      console.log(`✓ Uppgraderade befintlig användare ${email} till admin.`);
    } else {
      await c.query(
        "INSERT INTO users (name, username, email, password_hash, is_admin) VALUES ($1,$2,$3,$4,true)",
        [name, username, email, passwordHash],
      );
      console.log(`✓ Skapade admin-användare ${email} (användarnamn: ${username}).`);
    }
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("Bootstrap-admin misslyckades:", err);
  process.exit(1);
});
