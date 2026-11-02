CREATE TYPE "public"."card_direction" AS ENUM('forward', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('tree', 'branch', 'leaf');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"direction" "card_direction" NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_review_at" timestamp with time zone,
	"stability" double precision DEFAULT 0 NOT NULL,
	"stability_fast" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 0 NOT NULL,
	"scheduled_days" double precision DEFAULT 0 NOT NULL,
	"learning_step" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"kind" "node_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_tree_is_root" CHECK (("nodes"."kind" = 'tree') = ("nodes"."parent_id" IS NULL)),
	CONSTRAINT "nodes_name_not_blank" CHECK (length(trim("nodes"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"front_md" text NOT NULL,
	"back_md" text NOT NULL,
	"reversible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"state" smallint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"stability_fast" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"scheduled_days" double precision NOT NULL,
	"learning_step" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "review_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"desired_retention" double precision DEFAULT 0.9 NOT NULL,
	"new_cards_per_day" integer DEFAULT 20 NOT NULL,
	"max_reviews_per_day" integer DEFAULT 200 NOT NULL,
	"enable_fuzz" boolean DEFAULT true NOT NULL,
	"fsrs_weights" jsonb,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_note_direction_uq" ON "cards" USING btree ("note_id","direction");--> statement-breakpoint
CREATE INDEX "cards_due_idx" ON "cards" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "nodes_parent_idx" ON "nodes" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "notes_node_idx" ON "notes" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "review_logs_card_idx" ON "review_logs" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "review_logs_reviewed_at_idx" ON "review_logs" USING btree ("reviewed_at");