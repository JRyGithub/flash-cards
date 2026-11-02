import { timingSafeEqual } from "node:crypto"

import { sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/env"
import { getDb } from "@/server/db/client"

/**
 * Called daily by Vercel Cron (see vercel.json) so the Supabase free-tier project isn't
 * paused for inactivity. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  // Reading the request first also keeps this handler out of build-time prerendering.
  const authorization = request.headers.get("authorization") ?? ""
  const secret = serverEnv().CRON_SECRET
  if (!secret || !matches(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await getDb().execute(sql`select 1`)
  return NextResponse.json({ ok: true })
}

function matches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
