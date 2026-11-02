const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Requires TLS for remote databases. postgres.js connects in plaintext unless asked, which
 * would send credentials and card data unencrypted to Supabase. An explicit `sslmode` in
 * the URL always wins, and local databases (tests, PGlite) are left as they are.
 */
export function withTls(url: string): string {
  const parsed = new URL(url)
  if (parsed.searchParams.has("sslmode") || LOCAL_HOSTS.has(parsed.hostname)) return url
  parsed.searchParams.set("sslmode", "require")
  return parsed.toString()
}
