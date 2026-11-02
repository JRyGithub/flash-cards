import { z } from "zod"

import { NotFoundError, ValidationError } from "../domain/errors"
import type { Card, Note, ReviewLog, TreeNode } from "../domain/types"
import type { Repositories, UnitOfWork } from "../repositories/interfaces"

/*
 * Versioned JSON backup format. Imports always create copies with fresh ids, so a backup
 * can be restored into an empty project or merged into an existing one without clashes.
 */

const EXPORT_VERSION = 1
const CHUNK = 500

const nodeSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  kind: z.enum(["tree", "branch", "leaf"]),
  name: z.string().min(1),
  description: z.string().nullable(),
  position: z.number().int(),
})

const noteSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  frontMd: z.string().min(1),
  backMd: z.string().min(1),
  reversible: z.boolean(),
})

const schedulingSchema = {
  state: z.number().int().min(0).max(3),
  dueAt: z.coerce.date(),
  stability: z.number(),
  stabilityFast: z.number(),
  difficulty: z.number(),
  scheduledDays: z.number(),
  learningStep: z.number().int(),
}

const cardSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  direction: z.enum(["forward", "reverse"]),
  ...schedulingSchema,
  lastReviewAt: z.coerce.date().nullable(),
  reps: z.number().int(),
  lapses: z.number().int(),
})

const reviewLogSchema = z.object({
  cardId: z.string(),
  rating: z.number().int().min(1).max(4),
  ...schedulingSchema,
  reviewedAt: z.coerce.date(),
  durationMs: z.number().int().nullable(),
})

export const exportBundleSchema = z.object({
  app: z.literal("flash-cards"),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  nodes: z.array(nodeSchema),
  notes: z.array(noteSchema),
  cards: z.array(cardSchema),
  reviewLogs: z.array(reviewLogSchema),
})

export type ExportBundle = z.input<typeof exportBundleSchema>

export interface ImportSummary {
  trees: number
  nodes: number
  notes: number
  cards: number
}

export class ExportService {
  constructor(
    private readonly deps: Pick<Repositories, "nodes" | "notes" | "cards" | "reviewLogs"> & {
      uow: UnitOfWork
    },
  ) {}

  /** Exports everything, or a single tree and its descendants. */
  async export(treeId?: string): Promise<ExportBundle> {
    const all = await this.deps.nodes.listAll()
    let nodes = all
    if (treeId) {
      const tree = all.find((n) => n.id === treeId)
      if (!tree) throw new NotFoundError("Node", treeId)
      if (tree.kind !== "tree") throw new ValidationError("Only whole trees can be exported")
      const ids = new Set(await this.deps.nodes.listSubtreeIds(treeId))
      nodes = all.filter((n) => ids.has(n.id))
    }

    const notes = await this.deps.notes.listByNodes(nodes.map((n) => n.id))
    const cards = await this.deps.cards.listByNotes(notes.map((n) => n.id))
    const logs = await this.deps.reviewLogs.listByCards(cards.map((c) => c.id))

    return {
      app: "flash-cards",
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(serialiseNode),
      notes: notes.map(serialiseNote),
      cards: cards.map(serialiseCard),
      reviewLogs: logs.map(serialiseLog),
    }
  }

  async import(raw: unknown): Promise<ImportSummary> {
    const parsed = exportBundleSchema.safeParse(raw)
    if (!parsed.success) throw new ValidationError("This file isn't a valid flash-cards export")
    const bundle = parsed.data
    const ordered = parentsFirst(bundle.nodes)

    return this.deps.uow.transaction(async (repos) => {
      const nodeIds = new Map<string, string>()
      const noteIds = new Map<string, string>()
      const cardIds = new Map<string, string>()
      let treePosition = await repos.nodes.nextPosition(null)

      for (const node of ordered) {
        const parentId = node.parentId ? nodeIds.get(node.parentId)! : null
        const created = await repos.nodes.create({
          parentId,
          kind: node.kind,
          name: node.name,
          description: node.description,
          position: parentId ? node.position : treePosition++,
        })
        nodeIds.set(node.id, created.id)
      }

      const notes = bundle.notes.filter((n) => nodeIds.has(n.nodeId))
      for (const chunk of chunks(notes)) {
        await repos.notes.createMany(
          chunk.map((n) => {
            const id = crypto.randomUUID()
            noteIds.set(n.id, id)
            return {
              id,
              nodeId: nodeIds.get(n.nodeId)!,
              frontMd: n.frontMd,
              backMd: n.backMd,
              reversible: n.reversible,
            }
          }),
        )
      }

      const cards = bundle.cards.filter((c) => noteIds.has(c.noteId))
      for (const chunk of chunks(cards)) {
        await repos.cards.createMany(
          chunk.map(({ id: oldId, noteId, direction, ...scheduling }) => {
            const id = crypto.randomUUID()
            cardIds.set(oldId, id)
            return { id, noteId: noteIds.get(noteId)!, direction, scheduling }
          }),
        )
      }

      const logs = bundle.reviewLogs.filter((l) => cardIds.has(l.cardId))
      for (const chunk of chunks(logs)) {
        await repos.reviewLogs.createMany(
          chunk.map((l) => ({ ...l, cardId: cardIds.get(l.cardId)! })),
        )
      }

      return {
        trees: ordered.filter((n) => n.kind === "tree").length,
        nodes: ordered.length,
        notes: notes.length,
        cards: cards.length,
      }
    })
  }
}

/** Orders nodes so parents are created before children; every root must be a tree. */
function parentsFirst<T extends { id: string; parentId: string | null; kind: string }>(
  nodes: T[],
): T[] {
  const ids = new Set(nodes.map((n) => n.id))
  const byParent = new Map<string | null, T[]>()
  for (const node of nodes) {
    const key = node.parentId && ids.has(node.parentId) ? node.parentId : null
    if (key === null && node.kind !== "tree") {
      throw new ValidationError(`"${node.id}" has no parent tree in this export`)
    }
    byParent.set(key, [...(byParent.get(key) ?? []), node])
  }

  const ordered: T[] = []
  const queue = [...(byParent.get(null) ?? [])]
  while (queue.length) {
    const node = queue.shift()!
    ordered.push(node)
    queue.push(...(byParent.get(node.id) ?? []))
  }
  if (ordered.length !== nodes.length) throw new ValidationError("The export contains a cycle")
  return ordered
}

function* chunks<T>(items: T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += CHUNK) yield items.slice(i, i + CHUNK)
}

function serialiseNode(n: TreeNode) {
  return {
    id: n.id,
    parentId: n.parentId,
    kind: n.kind,
    name: n.name,
    description: n.description,
    position: n.position,
  }
}

function serialiseNote(n: Note) {
  return {
    id: n.id,
    nodeId: n.nodeId,
    frontMd: n.frontMd,
    backMd: n.backMd,
    reversible: n.reversible,
  }
}

function serialiseCard(c: Card) {
  return {
    id: c.id,
    noteId: c.noteId,
    direction: c.direction,
    state: c.state,
    dueAt: c.dueAt.toISOString(),
    lastReviewAt: c.lastReviewAt?.toISOString() ?? null,
    stability: c.stability,
    stabilityFast: c.stabilityFast,
    difficulty: c.difficulty,
    scheduledDays: c.scheduledDays,
    learningStep: c.learningStep,
    reps: c.reps,
    lapses: c.lapses,
  }
}

function serialiseLog(l: ReviewLog) {
  return {
    cardId: l.cardId,
    rating: l.rating,
    state: l.state,
    dueAt: l.dueAt.toISOString(),
    stability: l.stability,
    stabilityFast: l.stabilityFast,
    difficulty: l.difficulty,
    scheduledDays: l.scheduledDays,
    learningStep: l.learningStep,
    reviewedAt: l.reviewedAt.toISOString(),
    durationMs: l.durationMs,
  }
}
