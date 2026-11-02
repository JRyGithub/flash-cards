import type { EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/env"
import { isOwner, safeRedirectPath } from "@/server/auth/owner"
import { createSupabaseServerClient } from "@/server/auth/supabase"

/**
 * Completes GitHub OAuth (`?code=`) and magic-link (`?code=` or `?token_hash=`) sign-ins.
 * Anyone who isn't the configured owner is signed straight back out.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get("next"))
  const fail = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, origin))

  const supabase = await createSupabaseServerClient()
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("Missing auth code") }

  if (error || !data.user) return fail("link")

  const env = serverEnv()
  if (
    !isOwner(data.user, {
      adminEmail: env.ADMIN_EMAIL,
      adminGithubUsername: env.ADMIN_GITHUB_USERNAME,
    })
  ) {
    await supabase.auth.signOut()
    return fail("forbidden")
  }

  return NextResponse.redirect(new URL(next, origin))
}
