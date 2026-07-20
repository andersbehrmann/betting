-- Poäng-event: varje spel har ett poängvärde. Rätt svar ger dessa poäng i stället
-- för en andel av potten. Vinnardetekteringen är gemensam för båda event-typerna;
-- det enda som skiljer är vad som delas ut (se lib/recalc.ts).
ALTER TABLE games ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1
  CHECK (points >= 0);
