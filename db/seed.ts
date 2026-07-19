// Seed-data: ett exempel-event, spelarlista, alla spel + matchpaket, och 3 exempel-deltagare.
// Idempotent: raderar ev. befintligt event med samma slug (cascade) och skapar om.
//   npm run db:seed

import { randomUUID, randomBytes } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
import { GAME_DEFINITIONS, TEAM_ONE, TEAM_TWO } from "../lib/scoring/games";

config({ path: ".env.local", quiet: true });

const EVENT_SLUG = "final-2026";

function token(): string {
  return randomBytes(16).toString("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas (kontrollera .env.local)");
  const c = new pg.Client({ connectionString: url });
  await c.connect();

  try {
    await c.query("BEGIN");

    // Rensa ev. tidigare seed-event.
    await c.query("DELETE FROM events WHERE slug = $1", [EVENT_SLUG]);

    const now = Date.now();
    const matchStart = new Date(now + 3 * 3600 * 1000); // om ~3h
    const deadline = new Date(now + 2.5 * 3600 * 1000); // stänger strax innan → betting öppen nu

    const eventId = randomUUID();
    await c.query(
      `INSERT INTO events
        (id, name, slug, team_one, team_two, match_start, betting_deadline, betting_open,
         currency, default_stake, jackpot_stake, star_player_name, star_listen_target,
         count_staff_cards, closest_result_mode, package_tiebreak_exact,
         leaderboard_visible, bets_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,'SEK',5,10,$8,$9,false,'nearest',true,true,false)`,
      [
        eventId,
        "VM-finalen 2026",
        EVENT_SLUG,
        "Argentina",
        "Frankrike",
        matchStart.toISOString(),
        deadline.toISOString(),
        "Lionel Messi",
        "Lionel Messi",
      ],
    );

    // Spelarlista (6 per lag).
    const players: { name: string; team: 1 | 2 }[] = [
      { name: "Lionel Messi", team: 1 },
      { name: "Julián Álvarez", team: 1 },
      { name: "Ángel Di María", team: 1 },
      { name: "Lautaro Martínez", team: 1 },
      { name: "Enzo Fernández", team: 1 },
      { name: "Alexis Mac Allister", team: 1 },
      { name: "Kylian Mbappé", team: 2 },
      { name: "Antoine Griezmann", team: 2 },
      { name: "Ousmane Dembélé", team: 2 },
      { name: "Olivier Giroud", team: 2 },
      { name: "Aurélien Tchouaméni", team: 2 },
      { name: "Kingsley Coman", team: 2 },
    ];
    const playerIds: Record<string, string> = {};
    for (let i = 0; i < players.length; i++) {
      const id = randomUUID();
      playerIds[players[i].name] = id;
      await c.query(
        "INSERT INTO players (id, event_id, name, team, sort_order) VALUES ($1,$2,$3,$4,$5)",
        [id, eventId, players[i].name, players[i].team, i],
      );
    }

    // Spel (12 ordinarie + matchpaket) från definitionerna.
    const gameIds: Record<string, string> = {};
    for (const def of GAME_DEFINITIONS) {
      const id = randomUUID();
      gameIds[def.key] = id;
      await c.query(
        `INSERT INTO games (id, event_id, game_key, title, description, stake, is_jackpot, active, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,'open')`,
        [
          id,
          eventId,
          def.key,
          def.title,
          def.description ?? null,
          def.isJackpot ? 10 : 5,
          def.isJackpot,
          def.sortOrder,
        ],
      );
    }

    // Exempel-deltagare med tips.
    const messi = playerIds["Lionel Messi"];
    const mbappe = playerIds["Kylian Mbappé"];

    const participants: {
      name: string;
      bets: { key: string; answer: unknown }[];
    }[] = [
      {
        name: "Anna",
        bets: [
          { key: "world_champion", answer: { value: TEAM_ONE } },
          { key: "result_90", answer: { home: 2, away: 1 } },
          { key: "first_scorer", answer: { value: messi } },
          { key: "extra_time", answer: { value: "no" } },
          { key: "first_goal_time", answer: { value: "16-30" } },
          { key: "match_package", answer: { world_champion: TEAM_ONE, result_90: { home: 2, away: 1 }, first_scorer: messi, extra_time: "no" } },
        ],
      },
      {
        name: "Björn",
        bets: [
          { key: "world_champion", answer: { value: TEAM_TWO } },
          { key: "result_90", answer: { home: 1, away: 1 } },
          { key: "first_scorer", answer: { value: mbappe } },
          { key: "extra_time", answer: { value: "yes" } },
          { key: "penalties_shootout", answer: { value: "yes" } },
          { key: "match_package", answer: { world_champion: TEAM_TWO, result_90: { home: 1, away: 1 }, first_scorer: mbappe, extra_time: "yes" } },
        ],
      },
      {
        name: "Cecilia",
        bets: [
          { key: "world_champion", answer: { value: TEAM_ONE } },
          { key: "result_90", answer: { home: 3, away: 2 } },
          { key: "first_scorer", answer: { value: "own_goal" } },
          { key: "first_yellow", answer: { value: TEAM_TWO } },
          { key: "total_yellows", answer: { value: "3-4" } },
        ],
      },
    ];

    for (const p of participants) {
      const pid = randomUUID();
      await c.query(
        "INSERT INTO participants (id, event_id, name, access_token) VALUES ($1,$2,$3,$4)",
        [pid, eventId, p.name, token()],
      );
      for (const b of p.bets) {
        const gameId = gameIds[b.key];
        const stake = b.key === "match_package" ? 10 : 5;
        await c.query(
          "INSERT INTO bets (id, participant_id, game_id, answer_data, stake) VALUES ($1,$2,$3,$4,$5)",
          [randomUUID(), pid, gameId, JSON.stringify(b.answer), stake],
        );
      }
    }

    await c.query("COMMIT");
    console.log(`✓ Seed klar: event "${EVENT_SLUG}", ${players.length} spelare, ${GAME_DEFINITIONS.length} spel, ${participants.length} deltagare.`);
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("Seed misslyckades:", err);
  process.exit(1);
});
