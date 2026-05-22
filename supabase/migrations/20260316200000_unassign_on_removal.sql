-- When a user is removed from a project (active -> false),
-- unassign all their conversations in that project.
CREATE OR REPLACE FUNCTION unassign_conversations_on_project_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    UPDATE conversations
    SET assigned_user_id = NULL
    WHERE assigned_user_id = NEW.user_id
      AND project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_unassign_on_project_removal
AFTER UPDATE ON user_projects
FOR EACH ROW EXECUTE FUNCTION unassign_conversations_on_project_removal();
