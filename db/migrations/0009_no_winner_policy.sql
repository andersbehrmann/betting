-- Vad ska hända med potten i ett spel där ingen gissade rätt?
--
-- Tidigare fanns inget svar på frågan: inga vinnarrader skrevs, insatserna
-- samlades in men bokfördes ingenstans, och sammanräkningen lade tyst hela
-- mellanskillnaden på en enskild spelare. Nu väljer den som skapar eventet.
--
--   'refund'  – var och en får tillbaka sin egen insats (standard, alltid rätt)
--   'jackpot' – potten rullar över till jackpotspelets vinnare

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS no_winner_policy text NOT NULL DEFAULT 'refund'
    CHECK (no_winner_policy IN ('refund', 'jackpot'));
