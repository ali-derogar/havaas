CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','therapist','parent')),
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 auth_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS children (
 id uuid PRIMARY KEY, therapist_id uuid NOT NULL REFERENCES users(id),
 profile jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parent_children (
 parent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 PRIMARY KEY(parent_id,child_id)
);
CREATE TABLE IF NOT EXISTS invitations (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, email text NOT NULL,
 role text NOT NULL CHECK(role IN ('therapist','parent','admin')),
 purpose text NOT NULL CHECK(purpose IN ('invite','reset')),
 child_id uuid REFERENCES children(id) ON DELETE CASCADE, created_by uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessions_expire_idx ON auth_sessions(expire);
CREATE TABLE IF NOT EXISTS difficulty (
 child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE, game_id text NOT NULL,
 variant text NOT NULL, protocol integer NOT NULL, mode text NOT NULL DEFAULT 'adaptive' CHECK(mode IN ('adaptive','fixed')),
 level text NOT NULL DEFAULT 'easy' CHECK(level IN ('easy','medium','hard')), revision integer NOT NULL DEFAULT 1,
 updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(child_id,game_id,variant,protocol)
);
CREATE TABLE IF NOT EXISTS game_sessions (
 id uuid PRIMARY KEY, child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('baseline','training')),
 settings jsonb NOT NULL, difficulty_revision integer NOT NULL, result jsonb,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 legacy_id text, import_key text
);
CREATE UNIQUE INDEX IF NOT EXISTS session_import_unique ON game_sessions(child_id,import_key) WHERE import_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS game_sessions_child_idx ON game_sessions(child_id,started_at);
CREATE TABLE IF NOT EXISTS import_previews (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), document jsonb NOT NULL,
 expires_at timestamptz NOT NULL, committed_at timestamptz, response jsonb
);
CREATE TABLE IF NOT EXISTS legacy_profiles (source_key text PRIMARY KEY, child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE);
