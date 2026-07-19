-- Bettinglek – initialt schema.
-- All åtkomst sker server-side (server actions / route handlers). Auktorisering i app-lagret.

CREATE TABLE IF NOT EXISTS events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  slug                    text NOT NULL UNIQUE,
  team_one                text NOT NULL,
  team_two                text NOT NULL,
  match_start             timestamptz NOT NULL,
  betting_deadline        timestamptz NOT NULL,
  betting_open            boolean NOT NULL DEFAULT true,
  currency                text NOT NULL DEFAULT 'SEK',
  default_stake           numeric(10,2) NOT NULL DEFAULT 5,
  jackpot_stake           numeric(10,2) NOT NULL DEFAULT 10,
  star_player_name        text,
  star_listen_target      text,
  count_staff_cards       boolean NOT NULL DEFAULT false,
  closest_result_mode     text NOT NULL DEFAULT 'no_winner'
                            CHECK (closest_result_mode IN ('nearest', 'no_winner')),
  package_tiebreak_exact  boolean NOT NULL DEFAULT false,
  leaderboard_visible     boolean NOT NULL DEFAULT false,
  bets_public             boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Valbara målskyttar (spelarlista) per event.
CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  team        smallint NOT NULL CHECK (team IN (1, 2)),
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_event_idx ON players(event_id);

CREATE TABLE IF NOT EXISTS participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            text NOT NULL,
  access_token    text NOT NULL UNIQUE,
  payment_status  text NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid', 'paid', 'settled')),
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS participants_event_idx ON participants(event_id);
-- Namn måste vara unikt inom event (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS participants_event_name_uidx
  ON participants(event_id, lower(name));

CREATE TABLE IF NOT EXISTS games (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_key     text NOT NULL,
  title        text NOT NULL,
  description  text,
  stake        numeric(10,2) NOT NULL,
  is_jackpot   boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  result_data  jsonb,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'closed', 'awaiting_result', 'settled')),
  settled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, game_key)
);
CREATE INDEX IF NOT EXISTS games_event_idx ON games(event_id);

CREATE TABLE IF NOT EXISTS bets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  game_id        uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  answer_data    jsonb NOT NULL,
  stake          numeric(10,2) NOT NULL,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, game_id)
);
CREATE INDEX IF NOT EXISTS bets_game_idx ON bets(game_id);
CREATE INDEX IF NOT EXISTS bets_participant_idx ON bets(participant_id);

CREATE TABLE IF NOT EXISTS game_winners (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  payout         numeric(12,4) NOT NULL DEFAULT 0,
  is_manual      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, participant_id)
);
CREATE INDEX IF NOT EXISTS game_winners_game_idx ON game_winners(game_id);

-- Enkel audit-logg så inget resultat "raderas tyst".
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  actor       text NOT NULL,
  action      text NOT NULL,
  game_id     uuid REFERENCES games(id) ON DELETE SET NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_event_idx ON audit_log(event_id);
