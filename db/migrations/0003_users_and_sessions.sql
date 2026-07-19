-- Riktiga användarkonton, DB-baserade sessions och lösenordsåterställning.
-- All auktorisering sker fortsatt i app-lagret (server-side).

-- Användare. Lösenord hashas server-side (node:crypto scrypt): scrypt$N$r$p$salt$hash.
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  username       text NOT NULL,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  is_admin       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Unika, case-insensitive användarnamn och e-post.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx ON users(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx    ON users(lower(email));

-- Server-side sessionslagring. Cookien bär en opak token; DB lagrar bara sha256(token).
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  user_agent  text,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- Engångstokens för lösenordsåterställning (hashade, kort TTL, single-use).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pw_reset_user_idx ON password_reset_tokens(user_id);

-- OBS: Bootstrap-adminen (is_admin=true) kan inte seedas i SQL eftersom lösenordet
-- måste hashas i appen. Kör istället: npm run bootstrap-admin
