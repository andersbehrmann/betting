-- Kompis-leaderboards: privata delligor inom ett event. Bara inbjudna ser dem.
-- Medlemmar refererar users (inte participants) eftersom inbjudan är kopplad till
-- kontot – kopplingen till deltagarraden görs vid uträkning via participants.user_id.

CREATE TABLE IF NOT EXISTS friend_leaderboards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- Delas som länk; unikt så en kod aldrig pekar på två ligor.
  invite_code   text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS friend_lb_event_idx ON friend_leaderboards(event_id);
CREATE INDEX IF NOT EXISTS friend_lb_owner_idx ON friend_leaderboards(owner_user_id);

CREATE TABLE IF NOT EXISTS friend_leaderboard_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id uuid NOT NULL REFERENCES friend_leaderboards(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'joined'
                   CHECK (status IN ('invited', 'joined')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leaderboard_id, user_id)
);
CREATE INDEX IF NOT EXISTS friend_lb_members_user_idx ON friend_leaderboard_members(user_id);
