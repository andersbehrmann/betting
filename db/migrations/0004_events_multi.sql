-- Generalisera events till en flerevents-plattform (betting- eller poäng-typ).

-- Typ + livscykel
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'betting'
  CHECK (event_type IN ('betting', 'points'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('draft', 'open', 'closed'));

-- Engångsavgift för att ansluta (riktiga pengar via Stripe, Fas 3). I minor units
-- (öre) för att undvika flyttalsavrundning – Stripe vill ändå ha heltal.
ALTER TABLE events ADD COLUMN IF NOT EXISTS join_fee_cents integer NOT NULL DEFAULT 0
  CHECK (join_fee_cents >= 0);

-- Ägarskap + beskrivning/marknadsföring
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description     text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Generalisera de fotbollsspecifika NOT NULL-kolumnerna (behövs för poäng-/icke-match-event).
ALTER TABLE events ALTER COLUMN team_one         DROP NOT NULL;
ALTER TABLE events ALTER COLUMN team_two         DROP NOT NULL;
ALTER TABLE events ALTER COLUMN match_start      DROP NOT NULL;
ALTER TABLE events ALTER COLUMN betting_deadline DROP NOT NULL;

CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
