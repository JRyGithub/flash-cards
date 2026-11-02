"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { uuidSchema } from "@/lib/validation"
import { ValidationError } from "@/server/domain/errors"

import { ownerAction } from "./safe-action"

const csvSchema = z.object({
  nodeId: uuidSchema,
  text: z
    .string()
    .min(1, "Paste or upload some cards first")
    .max(4_000_000, "That file is too large (4MB max)"),
  defaultReversible: z.boolean(),
})

export async function importCsv(input: z.input<typeof csvSchema>) {
  const result = await ownerAction(csvSchema, input, ({ nodeId, text, defaultReversible }, s) =>
    s.imports.importCsv(nodeId, text, { defaultReversible }),
  )
  if (result.ok) refresh()
  return result
}

const backupSchema = z.object({
  json: z.string().min(1).max(4_000_000, "That file is too large (4MB max)"),
})

export async function importBackup(input: z.input<typeof backupSchema>) {
  const result = await ownerAction(backupSchema, input, ({ json }, s) =>
    s.exports.import(parseJson(json)),
  )
  if (result.ok) refresh()
  return result
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    throw new ValidationError("That file isn't valid JSON")
  }
}
