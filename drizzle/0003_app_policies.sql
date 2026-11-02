CREATE POLICY "cards_app_access" ON "cards" AS PERMISSIVE FOR ALL TO "flash_cards_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "nodes_app_access" ON "nodes" AS PERMISSIVE FOR ALL TO "flash_cards_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "notes_app_access" ON "notes" AS PERMISSIVE FOR ALL TO "flash_cards_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "review_logs_app_access" ON "review_logs" AS PERMISSIVE FOR ALL TO "flash_cards_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "settings_app_access" ON "settings" AS PERMISSIVE FOR ALL TO "flash_cards_app" USING (true) WITH CHECK (true);