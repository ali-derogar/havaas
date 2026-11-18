CREATE TABLE training_profiles (
 id uuid PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', settings jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 created_by uuid REFERENCES users(id), updated_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX training_profiles_active_name_idx ON training_profiles(lower(name)) WHERE NOT archived;
ALTER TABLE difficulty ADD COLUMN training_profile_id uuid REFERENCES training_profiles(id);
CREATE INDEX difficulty_training_profile_idx ON difficulty(training_profile_id) WHERE training_profile_id IS NOT NULL;
