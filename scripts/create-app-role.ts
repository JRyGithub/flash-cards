/*
 * Gives the least-privilege `flash_cards_app` role (see drizzle/0002_app_role.sql) a login
 * with a fresh random password, checks it can connect through the Supabase pooler, and
 * points DATABASE_URL at it. Run after `pnpm db:migrate`; re-run any time to rotate.
 *
 *   pnpm db:app-role
 *
 * Uses DIRECT_URL (the database owner) to set the password. Afterwards only migrations need
 * owner credentials; the app and Vercel use the restricted role.
 */
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { config } from "dotenv"
import postgres from "postgres"

import { withTls } from "../src/server/db/connection"

const ROLE = "flash_cards_app"
const ENV_FILES = [".env.local", ".env"]

config({ path: ENV_FILES, quiet: true })

async function main() {
  const ownerUrl = process.env.DIRECT_URL
  if (!ownerUrl) throw new Error("Set DIRECT_URL (the Session pooler string) first.")

  const owner = new URL(ownerUrl)
  // Supavisor usernames are `<role>.<project-ref>`; local Postgres has no suffix.
  const projectRef = owner.username.includes(".")
    ? owner.username.split(".").slice(1).join(".")
    : null
  // base64url only contains [A-Za-z0-9_-], so it's safe inside a SQL string literal.
  const password = randomBytes(24).toString("base64url")

  const admin = postgres(withTls(ownerUrl), { max: 1, prepare: false })
  try {
    const [role] = await admin`select 1 from pg_roles where rolname = ${ROLE}`
    if (!role) throw new Error(`Role ${ROLE} doesn't exist yet. Run \`pnpm db:migrate\` first.`)
    await admin.unsafe(`alter role ${ROLE} with login password '${password}'`)
  } finally {
    await admin.end({ timeout: 5 })
  }

  const appUrl = new URL(owner)
  appUrl.username = projectRef ? `${ROLE}.${projectRef}` : ROLE
  appUrl.password = password
  if (projectRef) appUrl.port = "6543" // Transaction pooler, as the serverless app expects
  appUrl.searchParams.delete("sslmode")

  // Supavisor can take a few seconds to pick up a new password.
  const app = postgres(withTls(appUrl.toString()), { max: 1, prepare: false })
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const [row] =
          await app`select current_user as user, (select count(*)::int from settings) as settings`
        console.log(`✓ Connected as ${row!.user} (settings rows: ${row!.settings})`)
        break
      } catch (error) {
        if (attempt >= 6) throw error
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      }
    }
  } finally {
    await app.end({ timeout: 5 })
  }

  const file = ENV_FILES.find(
    (f) => existsSync(f) && /^DATABASE_URL=/m.test(readFileSync(f, "utf8")),
  )
  if (!file) throw new Error("Couldn't find DATABASE_URL in .env.local or .env to update.")
  const contents = readFileSync(file, "utf8").replace(
    /^DATABASE_URL=.*$/m,
    `DATABASE_URL=${appUrl}`,
  )
  writeFileSync(file, contents)

  console.log(`✓ Updated DATABASE_URL in ${file} to use the ${ROLE} role.`)
  console.log(
    "  Copy that DATABASE_URL into your Vercel project's environment variables and redeploy.",
  )
}

main().catch((error) => {
  console.error(
    `✗ ${error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : error}`,
  )
  process.exit(1)
})
