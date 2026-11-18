ALTER TABLE users ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE children ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE game_sessions ADD COLUMN report_ref uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX game_sessions_report_ref_idx ON game_sessions(report_ref);
CREATE INDEX game_sessions_history_idx ON game_sessions(child_id,finished_at DESC,id DESC) WHERE result IS NOT NULL;
CREATE TABLE audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id),
 target_user_id uuid REFERENCES users(id), child_id uuid REFERENCES children(id),
 action text NOT NULL, changed_fields jsonb NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_time_idx ON audit_events(created_at DESC,id DESC);
CREATE INDEX audit_events_user_idx ON audit_events(target_user_id,created_at DESC,id DESC);
CREATE INDEX audit_events_actor_idx ON audit_events(actor_id,created_at DESC,id DESC);
CREATE FUNCTION management_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='users' THEN
  IF (to_jsonb(NEW)-ARRAY['revision','auth_version','last_login_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revision','auth_version','last_login_at']) THEN NEW.revision=OLD.revision+1; ELSE NEW.revision=OLD.revision; END IF;
 ELSE
  IF NEW.profile IS DISTINCT FROM OLD.profile OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN NEW.revision=OLD.revision+1; ELSE NEW.revision=OLD.revision; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_revision BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION management_revision();
CREATE TRIGGER children_revision BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION management_revision();
CREATE FUNCTION management_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous jsonb; current_row jsonb; fields jsonb='[]'; field text; allowed text[]; actor uuid; target uuid; child uuid; meta jsonb='{}'; event text;
BEGIN
 current_row=to_jsonb(NEW); previous=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 actor=nullif(current_setting('havaas.actor_id',true),'')::uuid;
 IF TG_TABLE_NAME='users' THEN
  allowed=ARRAY['username','name','email','role','active','pending','password_change_required','password_hash']; target=NEW.id;
 ELSIF TG_TABLE_NAME='children' THEN
  target=NEW.owner_user_id; child=NEW.id; allowed=ARRAY['firstName','lastName','birthDate','grade','school','concerns'];
  FOREACH field IN ARRAY allowed LOOP
   IF current_row->'profile'->field IS DISTINCT FROM previous->'profile'->field THEN fields=fields||jsonb_build_array('profile.'||field); END IF;
  END LOOP;
  IF current_row->'owner_user_id' IS DISTINCT FROM previous->'owner_user_id' THEN fields=fields||'"owner"'::jsonb; END IF;
  allowed=ARRAY[]::text[];
 ELSIF TG_TABLE_NAME='difficulty' THEN
  child=NEW.child_id; SELECT owner_user_id INTO target FROM children WHERE id=child;
  allowed=ARRAY['mode','level']; meta=jsonb_build_object('gameId',NEW.game_id,'variant',NEW.variant,'protocol',NEW.protocol);
 ELSE
  allowed=CASE TG_TABLE_NAME WHEN 'invitations' THEN ARRAY['purpose','used_at'] WHEN 'registration_links' THEN ARRAY['label','used_at','revoked_at'] ELSE ARRAY['label','revoked_at'] END;
  IF TG_TABLE_NAME='report_links' THEN child=NEW.child_id; SELECT owner_user_id INTO target FROM children WHERE id=child;
  ELSE target=NEW.user_id; END IF;
 END IF;
 FOREACH field IN ARRAY allowed LOOP
  IF current_row->field IS DISTINCT FROM previous->field THEN fields=fields||jsonb_build_array(CASE WHEN field='password_hash' THEN 'password' ELSE field END); END IF;
 END LOOP;
 IF jsonb_array_length(fields)=0 THEN RETURN NEW; END IF;
 event=TG_TABLE_NAME||CASE WHEN TG_OP='INSERT' THEN '.created' ELSE '.updated' END;
 INSERT INTO audit_events(actor_id,target_user_id,child_id,action,changed_fields,metadata) VALUES(actor,target,child,event,fields,meta);
 RETURN NEW;
END $$;
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION management_audit();
CREATE TRIGGER children_audit AFTER INSERT OR UPDATE ON children FOR EACH ROW EXECUTE FUNCTION management_audit();
CREATE TRIGGER difficulty_audit AFTER INSERT OR UPDATE ON difficulty FOR EACH ROW EXECUTE FUNCTION management_audit();
CREATE TRIGGER invitations_audit AFTER INSERT OR UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION management_audit();
CREATE TRIGGER registration_links_audit AFTER INSERT OR UPDATE ON registration_links FOR EACH ROW EXECUTE FUNCTION management_audit();
CREATE TRIGGER report_links_audit AFTER INSERT OR UPDATE ON report_links FOR EACH ROW EXECUTE FUNCTION management_audit();
