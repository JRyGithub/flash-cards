import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { publicEnv } from "@/env"

/** A Supabase client bound to the current request's auth cookies. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = publicEnv()
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        } catch {
          // Server Components can't write cookies; the proxy refreshes the session instead.
        }
      },
    },
  })
}
