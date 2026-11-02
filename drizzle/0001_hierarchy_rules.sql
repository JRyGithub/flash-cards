-- Hierarchy rules, enforced in the database as a backstop to NodeService:
--   * a branch or leaf must sit under a tree or a branch (never under a leaf)
--   * a node can't be moved beneath itself or one of its descendants
--   * a node's kind is fixed once created
--   * notes only attach to branches and leaves
CREATE OR REPLACE FUNCTION enforce_node_hierarchy() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_kind node_kind;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'A node''s kind cannot change' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kind INTO parent_kind FROM nodes WHERE id = NEW.parent_id;
  IF parent_kind = 'leaf' THEN
    RAISE EXCEPTION 'Leaves cannot have children' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    IF EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM nodes WHERE id = NEW.parent_id
        UNION ALL
        SELECT n.id, n.parent_id FROM nodes n JOIN ancestors a ON n.id = a.parent_id
      )
      SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A node cannot be moved beneath itself' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER nodes_enforce_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, kind ON nodes
FOR EACH ROW EXECUTE FUNCTION enforce_node_hierarchy();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_note_node_kind() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT kind FROM nodes WHERE id = NEW.node_id) = 'tree' THEN
    RAISE EXCEPTION 'Cards belong to branches or leaves, not trees' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER notes_enforce_node_kind
BEFORE INSERT OR UPDATE OF node_id ON notes
FOR EACH ROW EXECUTE FUNCTION enforce_note_node_kind();
--> statement-breakpoint
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
