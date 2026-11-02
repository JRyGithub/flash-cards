import { test as base, expect } from "@playwright/test"

export const APP_PORT = 3100
export const AUTH_PORT = 54321
export const DB_PORT = 55432
export const BASE_URL = `http://127.0.0.1:${APP_PORT}`

export const USERS = {
  owner: { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.com" },
  intruder: { id: "22222222-2222-4222-8222-222222222222", email: "intruder@example.com" },
}

/** A Supabase SSR session cookie for the stub auth server (it only checks the token's `sub`). */
export function sessionCookie(user: (typeof USERS)[keyof typeof USERS]) {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const exp = Math.floor(Date.now() / 1000) + 86_400
  const accessToken = [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      exp,
      iat: exp - 3600,
    }),
    "c2ln",
  ].join(".")
  const session = {
    access_token: accessToken,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 86_400,
    expires_at: exp,
    user: { id: user.id, email: user.email, aud: "authenticated" },
  }
  // The cookie name derives from the Supabase URL's first hostname label ("127").
  return { name: "sb-127-auth-token", value: `base64-${b64(session)}`, url: BASE_URL }
}

/** Fails any test whose page logs a Content-Security-Policy violation. */
export const cspGuard = base.extend<{ noCspViolations: void }>({
  noCspViolations: [
    async ({ page }, use) => {
      const violations: string[] = []
      page.on("console", (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
      })
      await use()
      expect(violations, "CSP violations").toEqual([])
    },
    { auto: true },
  ],
})

export const test = cspGuard.extend<{ asOwner: void }>({
  asOwner: [
    async ({ context }, use) => {
      await context.addCookies([sessionCookie(USERS.owner)])
      await use()
    },
    { auto: true },
  ],
})

export { expect }
