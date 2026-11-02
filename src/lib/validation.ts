import { z } from "zod"

/* Input schemas shared by forms (client) and Server Actions (server). */

export const uuidSchema = z.uuid()

export const nodeDetailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
})

export const createNodeSchema = nodeDetailsSchema.extend({
  parentId: uuidSchema.nullable(),
  kind: z.enum(["tree", "branch", "leaf"]),
})

export const noteContentSchema = z.object({
  frontMd: z.string().trim().min(1, "The front is required").max(20_000),
  backMd: z.string().trim().min(1, "The back is required").max(20_000),
  reversible: z.boolean(),
})

export const reviewSchema = z.object({
  nodeId: uuidSchema,
  cardId: uuidSchema,
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().int().min(0).max(3_600_000).nullable(),
})

export const settingsSchema = z.object({
  desiredRetention: z.number().min(0.7).max(0.99),
  newCardsPerDay: z.number().int().min(0).max(9999),
  maxReviewsPerDay: z.number().int().min(0).max(99999),
  enableFuzz: z.boolean(),
  timezone: z.string().min(1).max(64),
})

export type SettingsInput = z.infer<typeof settingsSchema>
