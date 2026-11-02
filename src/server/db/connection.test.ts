import { describe, expect, it } from "vitest"

import { withTls } from "./connection"

const pooler = "postgresql://user.ref:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

describe("withTls", () => {
  it("requires TLS for remote databases", () => {
    expect(new URL(withTls(pooler)).searchParams.get("sslmode")).toBe("require")
  })

  it("keeps other query parameters and the credentials", () => {
    const url = new URL(withTls(`${pooler}?max=3`))
    expect(url.searchParams.get("max")).toBe("3")
    expect(url.searchParams.get("sslmode")).toBe("require")
    expect(url.username).toBe("user.ref")
    expect(url.password).toBe("secret")
  })

  it("respects an explicit sslmode", () => {
    expect(withTls(`${pooler}?sslmode=verify-full`)).toBe(`${pooler}?sslmode=verify-full`)
  })

  it.each(["localhost", "127.0.0.1", "[::1]"])("leaves local %s alone", (host) => {
    const local = `postgres://postgres:postgres@${host}:5432/postgres`
    expect(withTls(local)).toBe(local)
  })
})
