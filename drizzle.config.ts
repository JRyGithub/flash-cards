import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

import { withTls } from "./src/server/db/connection"

config({ path: [".env.local", ".env"], quiet: true })

// Migrations need a session connection (DIRECT_URL); the app itself uses the pooler.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ? withTls(url) : "" },
  strict: true,
  verbose: true,
})
