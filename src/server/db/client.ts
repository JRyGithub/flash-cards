import "server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { serverEnv } from "@/env"

import { withTls } from "./connection"
import type { Database } from "./types"
import * as schema from "./schema"

export type { Database, DbExecutor } from "./types"

const globalForDb = globalThis as unknown as { db?: Database }

/**
 * One client per server instance (reused across hot reloads in dev). `prepare: false` is
 * required by Supabase's transaction pooler, which serverless deployments should use.
 * Pool options such as `?max=5` can be set on DATABASE_URL. TLS is required for remote hosts.
 */
export function getDb(): Database {
  if (!globalForDb.db) {
    const client = postgres(withTls(serverEnv().DATABASE_URL), { prepare: false })
    globalForDb.db = drizzle(client, { schema })
  }
  return globalForDb.db
}
