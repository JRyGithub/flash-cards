-- Least-privilege role for the running app. It can read and write rows in the app's tables
-- and nothing else: no DDL, no other schemas, no bypassing row level security. Migrations
-- still run as the database owner. Created without a login; `pnpm db:app-role` sets one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flash_cards_app') THEN
    CREATE ROLE flash_cards_app NOLOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO flash_cards_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON nodes, notes, cards, review_logs, settings TO flash_cards_app;
--> statement-breakpoint
-- Supabase's Data API roles are already blocked by RLS (no policies apply to them). Revoke
-- their table privileges as well, so a future policy mistake can't expose anything.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON nodes, notes, cards, review_logs, settings FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
