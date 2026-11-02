/*
 * Creates the single owner account in Supabase Auth (run once, after disabling sign-ups).
 *
 *   pnpm admin:create
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL from
 * .env.local / .env. Safe to re-run: an existing account is left untouched.
 */
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: [".env.local", ".env"], quiet: true })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.ADMIN_EMAIL?.toLowerCase()
  if (!url || !serviceKey || !email) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL first.",
    )
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true })

  if (error) {
    if (error.code === "email_exists" || /already been registered/i.test(error.message)) {
      console.log(`✓ ${email} already exists, nothing to do.`)
      return
    }
    throw error
  }
  console.log(`✓ Created owner account ${data.user.email} (${data.user.id}).`)
  console.log("  Sign in with GitHub (using this email) or with an emailed magic link.")
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
