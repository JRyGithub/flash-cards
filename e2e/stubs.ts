/*
 * Local stand-ins for Supabase so end-to-end tests drive the real app without any
 * test-only code paths in it:
 *   - Postgres: PGlite served over the wire protocol, with the project's migrations
 *   - Auth: a stub of GoTrue's /user endpoint that recognises the sessions in fixtures.ts
 */
import http from "node:http"

import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import { AUTH_PORT, DB_PORT, USERS } from "./fixtures"

async function main() {
  const db = await PGlite.create()
  await migrate(drizzle(db), { migrationsFolder: "./drizzle" })
  await new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1" }).start()
  serveAuth()
  console.log(`stubs ready: postgres :${DB_PORT}, auth :${AUTH_PORT}`)
}

function serveAuth() {
  http
    .createServer((req, res) => {
      res.setHeader("content-type", "application/json")
      if (req.url === "/health") return res.end("{}")

      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "")
      const sub = decodeSub(token)
      const user = Object.values(USERS).find((u) => u.id === sub)

      if (req.url?.startsWith("/auth/v1/user") && user) {
        return res.end(
          JSON.stringify({
            ...user,
            aud: "authenticated",
            role: "authenticated",
            identities: [],
            app_metadata: {},
            user_metadata: {},
          }),
        )
      }
      if (req.url?.startsWith("/auth/v1/logout")) {
        res.statusCode = 204
        return res.end()
      }
      res.statusCode = 401
      res.end(JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }))
    })
    .listen(AUTH_PORT, "127.0.0.1")
}

function decodeSub(token: string): string | null {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).sub
  } catch {
    return null
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
