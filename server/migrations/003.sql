CREATE TABLE registration_links (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL UNIQUE,
 label text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 user_id uuid REFERENCES users(id),
 revoked_at timestamptz
);
CREATE INDEX registration_links_created_idx ON registration_links(created_at DESC);
CREATE INDEX game_sessions_finished_idx ON game_sessions(finished_at,child_id) WHERE result IS NOT NULL;
