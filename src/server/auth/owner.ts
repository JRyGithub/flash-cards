export interface OwnerConfig {
  adminEmail: string
  adminGithubUsername?: string
}

interface AuthUserLike {
  email?: string | null
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> | null
}

/**
 * The app has exactly one owner, configured by environment. A user is the owner when
 * their verified email matches ADMIN_EMAIL and, if ADMIN_GITHUB_USERNAME is set, any
 * linked GitHub identity belongs to that username.
 */
export function isOwner(user: AuthUserLike | null | undefined, config: OwnerConfig): boolean {
  if (!user?.email || user.email.toLowerCase() !== config.adminEmail.toLowerCase()) return false

  if (config.adminGithubUsername) {
    const expected = config.adminGithubUsername.toLowerCase()
    const github = (user.identities ?? []).filter((i) => i.provider === "github")
    const mismatch = github.some(
      (i) => String(i.identity_data?.user_name ?? "").toLowerCase() !== expected,
    )
    if (mismatch) return false
  }
  return true
}

/** Only allow same-origin relative redirects, e.g. "/nodes/123", never "//evil.com". */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback
  return next
}
