"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createNodeSchema, nodeDetailsSchema, uuidSchema } from "@/lib/validation"

import { ownerAction } from "./safe-action"

export async function createNode(input: z.input<typeof createNodeSchema>) {
  const result = await ownerAction(createNodeSchema, input, ({ parentId, kind, ...details }, s) =>
    parentId ? s.nodes.createChild(parentId, kind, details) : s.nodes.createTree(details),
  )
  if (result.ok) refresh()
  return result.ok ? { ok: true as const, data: { id: result.data.id } } : result
}

const updateSchema = nodeDetailsSchema.extend({ id: uuidSchema })

export async function updateNode(input: z.input<typeof updateSchema>) {
  const result = await ownerAction(updateSchema, input, async ({ id, ...details }, s) => {
    await s.nodes.update(id, details)
  })
  if (result.ok) refresh()
  return result
}

const moveSchema = z.object({ id: uuidSchema, parentId: uuidSchema })

export async function moveNode(input: z.input<typeof moveSchema>) {
  const result = await ownerAction(moveSchema, input, async ({ id, parentId }, s) => {
    await s.nodes.move(id, parentId)
  })
  if (result.ok) refresh()
  return result
}

const reorderSchema = z.object({ id: uuidSchema, direction: z.enum(["up", "down"]) })

export async function reorderNode(input: z.input<typeof reorderSchema>) {
  const result = await ownerAction(reorderSchema, input, async ({ id, direction }, s) => {
    await s.nodes.reorder(id, direction)
  })
  if (result.ok) refresh()
  return result
}

export async function deleteNode(id: string) {
  const result = await ownerAction(uuidSchema, id, (nodeId, s) => s.nodes.delete(nodeId))
  if (!result.ok) return result
  redirect(result.data.parentId ? `/nodes/${result.data.parentId}` : "/")
}
