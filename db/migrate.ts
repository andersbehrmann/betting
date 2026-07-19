// Enkel migrationskörare mot Neon/Postgres.
//   npm run db:migrate            – kör alla ej applicerade migrationer
//   npm run db:migrate -- --reset – släpp allt (DROP SCHEMA) och kör om från noll
//
// Läser hemligheter från .env.local (laddas explicit – fristående script auto-laddar inte).

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas (kontrollera .env.local)");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (reset) {
      console.log("⚠️  --reset: släpper schema public och bygger om från noll…");
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map(
        (r) => r.filename,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`→ kör migration ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log(ran === 0 ? "✓ Inga nya migrationer att köra." : `✓ Klart – ${ran} migration(er) körda.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration misslyckades:", err);
  process.exit(1);
});
