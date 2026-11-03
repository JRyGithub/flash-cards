import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

/*
 * First line of defence: refreshes the Supabase session cookie and sends signed-out
 * visitors to /login. Authorisation (is this the owner?) is enforced again next to the
 * data by requireOwner(), so a bypass here never exposes anything.
 */

const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
        },
      },
    },
  )

  // getClaims() verifies the JWT (and refreshes it when expired). Don't run code between
  // creating the client and this call, or sessions may be dropped unexpectedly.
  const { data } = await supabase.auth.getClaims()
  const { pathname, search } = request.nextUrl

  if (!data?.claims && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(login)
  }

  return response
}

// Static assets, icons and the web app manifest are public: phones fetch the manifest and
// home-screen icons without the session cookie.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
