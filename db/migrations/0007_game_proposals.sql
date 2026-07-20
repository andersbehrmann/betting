-- Deltagare kan föreslå nya spel. Admin godkänner, justerar eller avslår.
-- Ett godkänt förslag blir ALLTID ett utkast (draft) som admin finjusterar och
-- öppnar själv – aldrig ett direkt publicerat spel.

-- Utkast som spelstatus. CHECK:en från 0001 är auto-namngiven och måste släppas först.
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('draft', 'open', 'closed', 'awaiting_result', 'settled'));

-- Spårbarhet: vem föreslog spelet.
ALTER TABLE games ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS game_proposals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  proposed_by       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  -- Samma form som games.options: [{ "value": "o0", "label": "..." }, ...]
  suggested_options jsonb,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note        text,
  reviewed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  -- Spelet som skapades när förslaget godkändes.
  created_game_id   uuid REFERENCES games(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_proposals_event_idx  ON game_proposals(event_id);
CREATE INDEX IF NOT EXISTS game_proposals_status_idx ON game_proposals(event_id, status);
