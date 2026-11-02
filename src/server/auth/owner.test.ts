import { describe, expect, it } from "vitest"

import { isOwner, safeRedirectPath } from "./owner"

const config = { adminEmail: "me@example.com" }

describe("isOwner", () => {
  it("matches the admin email case-insensitively", () => {
    expect(isOwner({ email: "Me@Example.com" }, config)).toBe(true)
    expect(isOwner({ email: "someone@example.com" }, config)).toBe(false)
    expect(isOwner({ email: null }, config)).toBe(false)
    expect(isOwner(null, config)).toBe(false)
  })

  it("requires linked GitHub identities to match the configured username", () => {
    const withGithub = (user_name: string) => ({
      email: "me@example.com",
      identities: [
        { provider: "email", identity_data: {} },
        { provider: "github", identity_data: { user_name } },
      ],
    })
    const strict = { ...config, adminGithubUsername: "octocat" }
    expect(isOwner(withGithub("OctoCat"), strict)).toBe(true)
    expect(isOwner(withGithub("impostor"), strict)).toBe(false)
    expect(isOwner(withGithub("impostor"), config)).toBe(true)
    expect(isOwner({ email: "me@example.com", identities: [] }, strict)).toBe(true)
  })
})

describe("safeRedirectPath", () => {
  it.each([
    ["/nodes/1", "/nodes/1"],
    [null, "/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected)
  })
})
