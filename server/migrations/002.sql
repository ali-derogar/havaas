ALTER TABLE users ADD COLUMN username text;
ALTER TABLE users ADD COLUMN legacy_email_login boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN pending boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN password_change_required boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE children RENAME COLUMN therapist_id TO legacy_manager_id;
ALTER TABLE children ADD COLUMN owner_user_id uuid UNIQUE REFERENCES users(id);
UPDATE children c SET owner_user_id=u.id FROM users u WHERE c.legacy_manager_id=u.id
 AND u.role='therapist' AND (SELECT count(*) FROM children x WHERE x.legacy_manager_id=u.id)=1;
ALTER TABLE children ALTER COLUMN legacy_manager_id DROP NOT NULL;
UPDATE users SET active=false WHERE role='parent' OR (role='therapist' AND NOT EXISTS(SELECT 1 FROM children c WHERE c.owner_user_id=users.id));
ALTER TABLE users DROP CONSTRAINT users_role_check;
UPDATE users SET username=CASE WHEN role='admin' THEN 'admin_' ELSE 'user_' END||replace(id::text,'-',''),
 legacy_email_login=true, role=CASE WHEN role='admin' THEN 'admin' ELSE 'user' END, auth_version=auth_version+1;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','user'));
ALTER TABLE users ADD CONSTRAINT users_username_check CHECK(username ~ '^[a-z0-9][a-z0-9._-]{2,63}$');
CREATE UNIQUE INDEX users_username_unique ON users(lower(username));
ALTER TABLE users ADD CONSTRAINT users_password_state CHECK(pending OR password_hash IS NOT NULL);
ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
UPDATE invitations SET used_at=COALESCE(used_at,now()),role=CASE WHEN role='admin' THEN 'admin' ELSE 'user' END;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK(role IN ('admin','user'));
ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE invitations ADD COLUMN user_id uuid REFERENCES users(id);
DROP TABLE parent_children;
DELETE FROM auth_sessions;
CREATE TABLE report_links (
 id uuid PRIMARY KEY, child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, label text NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX report_links_child_idx ON report_links(child_id,created_at);
