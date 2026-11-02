import { z } from "zod"

/**
 * Environment configuration. Everything a fork needs to change lives here, so the
 * app can be deployed without code edits. Parsing is lazy so `next build` and unit
 * tests don't require secrets to be present.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
})

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().min(1),
  ADMIN_EMAIL: z.email().transform((v) => v.toLowerCase()),
  ADMIN_GITHUB_USERNAME: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  CRON_SECRET: z.string().min(16).optional(),
})

export type PublicEnv = z.infer<typeof publicSchema>
export type ServerEnv = z.infer<typeof serverSchema>

let cachedServerEnv: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  cachedServerEnv ??= parse(serverSchema, process.env)
  return cachedServerEnv
}

/** Public values must be referenced statically so Next.js inlines them into the client bundle. */
export function publicEnv(): PublicEnv {
  return parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ")
    throw new Error(`Invalid or missing environment variables: ${fields}. See .env.example.`)
  }
  return result.data
}
