CREATE TABLE game_timing_defaults (
 game_id text NOT NULL, variant text NOT NULL, timing_family text NOT NULL, protocol integer NOT NULL,
 level text NOT NULL CHECK(level IN ('easy','medium','hard')), timing jsonb,
 revision integer NOT NULL DEFAULT 1, updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(game_id,variant,timing_family,protocol,level)
);
CREATE TABLE child_game_timing_overrides (
 child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 game_id text NOT NULL, variant text NOT NULL, timing_family text NOT NULL, protocol integer NOT NULL,
 level text NOT NULL CHECK(level IN ('easy','medium','hard')), timing jsonb,
 revision integer NOT NULL DEFAULT 1, updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(child_id,game_id,variant,timing_family,protocol,level)
);
