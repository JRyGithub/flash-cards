import { type NextRequest, NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/server/auth/supabase"

/** Clears a session that isn't allowed in (Server Components can't write cookies themselves). */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const error = request.nextUrl.searchParams.get("error") === "forbidden" ? "?error=forbidden" : ""
  return NextResponse.redirect(new URL(`/login${error}`, request.nextUrl.origin))
}
