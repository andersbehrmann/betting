-- participants blir "event-medlemskap": kopplar en användare till ett event.
-- Legacy anonyma rader (user_id NULL, access_token) fungerar oförändrat.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Avgiftsstatus (skild från payment_status som är extern betting-avräkning).
ALTER TABLE participants ADD COLUMN IF NOT EXISTS join_fee_status text NOT NULL DEFAULT 'none'
  CHECK (join_fee_status IN ('none', 'pending', 'paid', 'refunded'));
ALTER TABLE participants ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   text;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS join_fee_paid_at           timestamptz;

-- access_token är legacy nu; tillåt NULL för kontobaserade medlemmar.
ALTER TABLE participants ALTER COLUMN access_token DROP NOT NULL;

-- En medlem per (event, användare). Partiellt så legacy-rader (user_id NULL) inte påverkas.
CREATE UNIQUE INDEX IF NOT EXISTS participants_event_user_uidx
  ON participants(event_id, user_id) WHERE user_id IS NOT NULL;

-- Idempotens-ledger för Stripe-webhooks (Fas 3).
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
