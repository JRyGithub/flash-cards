import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core"

import type * as schema from "./schema"

type Schema = typeof schema

/** Driver-agnostic handle: postgres.js in the app, PGlite in integration tests. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>

/** A database handle or an open transaction; repositories accept either. */
export type DbExecutor =
  Database | PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>

/** Rows from `db.execute()`, which postgres.js returns as an array and other drivers as `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
}
