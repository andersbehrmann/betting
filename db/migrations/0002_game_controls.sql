-- Per-spel betting-kontroll + stöd för egna (custom) spel.

-- Admin kan öppna/stänga betting per enskilt spel, oberoende av globalt tipsstopp.
ALTER TABLE games ADD COLUMN IF NOT EXISTS betting_open boolean NOT NULL DEFAULT true;

-- Egna svarsalternativ för custom-spel (standardspelens val kommer från koden).
-- Format: [{ "value": "o0", "label": "..." }, ...]. NULL för standardspel.
ALTER TABLE games ADD COLUMN IF NOT EXISTS options jsonb;

-- Markera vilka spel som är egna (custom) – de poängräknas som flervalsspel.
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
