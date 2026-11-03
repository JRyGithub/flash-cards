import "server-only"

import { notFound } from "next/navigation"
import { cache } from "react"

import { shuffle } from "@/lib/shuffle"
import type { NodeSummary, NoteView } from "@/lib/view-models"
import { uuidSchema } from "@/lib/validation"

import { requireOwner } from "./auth/session"
import { getServices } from "./container"
import { NotFoundError } from "./domain/errors"
import { byPosition, canHaveChildren, canHoldNotes } from "./domain/hierarchy"
import { EMPTY_COUNTS, type TreeNode } from "./domain/types"

/*
 * Read models for pages. Each one authorises the owner first, so a page can never render
 * data without going through the Data Access Layer.
 */

/** Every node with rolled-up due counts. Shared by the sidebar and pages in one request. */
export const getNodeSummaries = cache(async (): Promise<NodeSummary[]> => {
  await requireOwner()
  const { nodes, study } = getServices()
  const [all, counts, totals] = await Promise.all([
    nodes.listAll(),
    study.countsForAll(),
    study.cardTotalsForAll(),
  ])
  return all.map((n) => toSummary(n, counts.get(n.id), totals.get(n.id)))
})

export interface MoveTarget {
  id: string
  name: string
  depth: number
  kind: TreeNode["kind"]
}

export async function getNodePage(rawId: string) {
  const id = parseId(rawId)
  const summaries = await getNodeSummaries()
  const node = summaries.find((n) => n.id === id)
  if (!node) notFound()

  const { nodes, notes } = getServices()
  const [path, noteList] = await Promise.all([
    nodes.getPath(id),
    canHoldNotes(node.kind) ? notes.listByNode(id) : Promise.resolve([]),
  ])

  return {
    node,
    path: path.map(({ id, name, kind }) => ({ id, name, kind })),
    children: summaries.filter((n) => n.parentId === id).sort(byPosition),
    notes: noteList.map(({ id, frontMd, backMd, reversible }): NoteView => ({
      id,
      frontMd,
      backMd,
      reversible,
    })),
    moveTargets: node.kind === "tree" ? [] : moveTargets(summaries, node),
    canHaveChildren: canHaveChildren(node.kind),
    canHoldNotes: canHoldNotes(node.kind),
  }
}

export async function getStudyStart(rawId: string) {
  const id = parseId(rawId)
  await requireOwner()
  const { nodes, study } = getServices()
  try {
    const [node, state] = await Promise.all([nodes.get(id), study.next(id)])
    return { node: { id: node.id, name: node.name, kind: node.kind }, state }
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function getPracticeStart(rawId: string) {
  const id = parseId(rawId)
  await requireOwner()
  const { nodes, study } = getServices()
  try {
    const [node, deck] = await Promise.all([nodes.get(id), study.practiceDeck(id)])
    return { node: { id: node.id, name: node.name, kind: node.kind }, deck: shuffle(deck) }
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function getSettings() {
  await requireOwner()
  return getServices().settings.get()
}

function parseId(raw: string): string {
  const parsed = uuidSchema.safeParse(raw)
  if (!parsed.success) notFound()
  return parsed.data
}

function toSummary(n: TreeNode, counts = EMPTY_COUNTS, cardCount = 0): NodeSummary {
  return {
    id: n.id,
    parentId: n.parentId,
    kind: n.kind,
    name: n.name,
    description: n.description,
    position: n.position,
    counts,
    cardCount,
  }
}

/** Trees and branches outside the node's own subtree, in tree order with depth for indenting. */
function moveTargets(all: NodeSummary[], node: NodeSummary): MoveTarget[] {
  const children = new Map<string | null, NodeSummary[]>()
  for (const n of [...all].sort(byPosition)) {
    children.set(n.parentId, [...(children.get(n.parentId) ?? []), n])
  }
  const targets: MoveTarget[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const n of children.get(parentId) ?? []) {
      if (n.id === node.id || !canHaveChildren(n.kind)) continue
      targets.push({ id: n.id, name: n.name, depth, kind: n.kind })
      walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  return targets
}
