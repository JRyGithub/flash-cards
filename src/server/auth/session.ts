import "server-only"

import { redirect } from "next/navigation"
import { connection } from "next/server"
import { cache } from "react"

import { serverEnv } from "@/env"

import { isOwner } from "./owner"
import { createSupabaseServerClient } from "./supabase"

export interface Owner {
  id: string
  email: string
}

type SessionStatus =
  | { status: "owner"; owner: Owner }
  | { status: "anonymous" }
  /** Signed in with Supabase, but not as the configured owner. */
  | { status: "forbidden" }

/**
 * Data Access Layer entry point. `getUser()` validates the session with Supabase Auth
 * rather than trusting the cookie, then the user is checked against the configured owner.
 * Deduplicated per request.
 */
export const getSessionStatus = cache(async (): Promise<SessionStatus> => {
  // Everything behind the session check is per-request (Supabase and the study clock read
  // the current time), so opt out of prerendering explicitly.
  await connection()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { status: "anonymous" }

  const env = serverEnv()
  const owner = isOwner(data.user, {
    adminEmail: env.ADMIN_EMAIL,
    adminGithubUsername: env.ADMIN_GITHUB_USERNAME,
  })
  if (!owner) return { status: "forbidden" }
  return { status: "owner", owner: { id: data.user.id, email: data.user.email! } }
})

/** Call at the top of every Server Action, Route Handler and data-loading component. */
export async function requireOwner(): Promise<Owner> {
  const session = await getSessionStatus()
  if (session.status === "owner") return session.owner
  // A non-owner session is cleared by the sign-out route so it can't linger.
  redirect(session.status === "forbidden" ? "/auth/signout?error=forbidden" : "/login")
}
