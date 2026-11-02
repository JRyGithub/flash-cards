import "server-only"

import { z } from "zod"

import { requireOwner } from "@/server/auth/session"
import { getServices } from "@/server/container"
import { DomainError } from "@/server/domain/errors"
import type { Services } from "@/server/services"

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Every Server Action goes through here: authorise the owner, validate input with zod,
 * run the use case, and turn expected (domain/validation) failures into a result the UI
 * can show. Unexpected errors and Next.js redirects are re-thrown untouched.
 */
export async function ownerAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  run: (data: z.infer<S>, services: Services) => Promise<T>,
): Promise<ActionResult<T>> {
  await requireOwner()
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  try {
    return { ok: true, data: await run(parsed.data, getServices()) }
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message }
    if (isCheckViolation(error)) return { ok: false, error: (error as Error).message }
    throw error
  }
}

/** Database trigger/constraint failures (SQLSTATE 23514) carry a user-safe message. */
function isCheckViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause
  return (error as { code?: string })?.code === "23514" || cause?.code === "23514"
}
