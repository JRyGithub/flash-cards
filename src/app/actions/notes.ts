"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { noteContentSchema, uuidSchema } from "@/lib/validation"

import { ownerAction } from "./safe-action"

const createSchema = noteContentSchema.extend({ nodeId: uuidSchema })

export async function createNote(input: z.input<typeof createSchema>) {
  const result = await ownerAction(createSchema, input, async ({ nodeId, ...content }, s) => {
    await s.notes.create(nodeId, content)
  })
  if (result.ok) refresh()
  return result
}

const updateSchema = noteContentSchema.extend({ id: uuidSchema })

export async function updateNote(input: z.input<typeof updateSchema>) {
  const result = await ownerAction(updateSchema, input, async ({ id, ...content }, s) => {
    await s.notes.update(id, content)
  })
  if (result.ok) refresh()
  return result
}

export async function deleteNote(id: string) {
  const result = await ownerAction(uuidSchema, id, async (noteId, s) => {
    await s.notes.delete(noteId)
  })
  if (result.ok) refresh()
  return result
}
