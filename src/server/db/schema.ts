import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/*
 * Every table has row level security, and the only policy grants the app's own role
 * (created in drizzle/0002_app_role.sql) full access. Supabase's anon/authenticated roles
 * match no policy, so the public Data API can't see or change app data.
 *
 * A new table needs `...appAccess(name)` here and a GRANT to flash_cards_app in a migration.
 */

export const appRole = pgRole("flash_cards_app").existing()

const appAccess = (table: string) =>
  pgPolicy(`${table}_app_access`, {
    for: "all",
    to: appRole,
    using: sql`true`,
    withCheck: sql`true`,
  })

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const nodeKind = pgEnum("node_kind", ["tree", "branch", "leaf"])
export const cardDirection = pgEnum("card_direction", ["forward", "reverse"])

export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => nodes.id, { onDelete: "cascade" }),
    kind: nodeKind("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("nodes_parent_idx").on(t.parentId, t.position),
    check("nodes_tree_is_root", sql`(${t.kind} = 'tree') = (${t.parentId} IS NULL)`),
    check("nodes_name_not_blank", sql`length(trim(${t.name})) > 0`),
    appAccess("nodes"),
  ],
).enableRLS()

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    frontMd: text("front_md").notNull(),
    backMd: text("back_md").notNull(),
    reversible: boolean("reversible").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("notes_node_idx").on(t.nodeId), appAccess("notes")],
).enableRLS()

/** FSRS scheduling state, one row per reviewable direction of a note. */
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    direction: cardDirection("direction").notNull(),
    state: smallint("state").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    stability: doublePrecision("stability").notNull().default(0),
    stabilityFast: doublePrecision("stability_fast").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(0),
    scheduledDays: doublePrecision("scheduled_days").notNull().default(0),
    learningStep: integer("learning_step").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex("cards_note_direction_uq").on(t.noteId, t.direction),
    index("cards_due_idx").on(t.dueAt),
    appAccess("cards"),
  ],
).enableRLS()

/** Snapshot of the card *before* each review, plus the rating given. */
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    state: smallint("state").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    stability: doublePrecision("stability").notNull(),
    stabilityFast: doublePrecision("stability_fast").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    scheduledDays: doublePrecision("scheduled_days").notNull(),
    learningStep: integer("learning_step").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms"),
  },
  (t) => [
    index("review_logs_card_idx").on(t.cardId),
    index("review_logs_reviewed_at_idx").on(t.reviewedAt),
    appAccess("review_logs"),
  ],
).enableRLS()

export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    desiredRetention: doublePrecision("desired_retention").notNull().default(0.9),
    newCardsPerDay: integer("new_cards_per_day").notNull().default(20),
    maxReviewsPerDay: integer("max_reviews_per_day").notNull().default(200),
    enableFuzz: boolean("enable_fuzz").notNull().default(true),
    fsrsWeights: jsonb("fsrs_weights").$type<number[]>(),
    timezone: text("timezone").notNull().default("UTC"),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`), appAccess("settings")],
).enableRLS()

export type NodeRow = typeof nodes.$inferSelect
export type NoteRow = typeof notes.$inferSelect
export type CardRow = typeof cards.$inferSelect
export type ReviewLogRow = typeof reviewLogs.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
