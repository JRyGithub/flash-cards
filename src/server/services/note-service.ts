import { InvariantViolation, NotFoundError } from "../domain/errors"
import { canHoldNotes } from "../domain/hierarchy"
import type { CardDirection, Note } from "../domain/types"
import type { NodeRepository, NoteRepository, UnitOfWork } from "../repositories/interfaces"

export interface NoteContent {
  frontMd: string
  backMd: string
  reversible: boolean
}

export class NoteService {
  constructor(
    private readonly deps: {
      nodes: NodeRepository
      notes: NoteRepository
      uow: UnitOfWork
    },
  ) {}

  listByNode(nodeId: string): Promise<Note[]> {
    return this.deps.notes.listByNode(nodeId)
  }

  async get(id: string): Promise<Note> {
    const note = await this.deps.notes.findById(id)
    if (!note) throw new NotFoundError("Note", id)
    return note
  }

  async create(nodeId: string, content: NoteContent): Promise<Note> {
    const [note] = await this.createMany(nodeId, [content])
    return note!
  }

  /** Creates notes and their cards (forward, plus reverse when reversible) atomically. */
  async createMany(nodeId: string, contents: readonly NoteContent[]): Promise<Note[]> {
    await this.assertCanHoldNotes(nodeId)
    const input = contents.map((c) => ({ nodeId, ...normalise(c) }))

    return this.deps.uow.transaction(async ({ notes, cards }) => {
      const created = await notes.createMany(input)
      await cards.createMany(
        created.flatMap((note) =>
          directionsFor(note.reversible).map((direction) => ({ noteId: note.id, direction })),
        ),
      )
      return created
    })
  }

  /**
   * Updates content. Toggling `reversible` adds or removes only the reverse card, so the
   * forward card keeps its review history.
   */
  async update(id: string, content: NoteContent): Promise<Note> {
    const existing = await this.get(id)
    const patch = normalise(content)

    return this.deps.uow.transaction(async ({ notes, cards }) => {
      const note = await notes.update(id, patch)
      if (patch.reversible && !existing.reversible) {
        await cards.createMany([{ noteId: id, direction: "reverse" }])
      } else if (!patch.reversible && existing.reversible) {
        await cards.deleteByNoteAndDirection(id, "reverse")
      }
      return note
    })
  }

  async delete(id: string): Promise<Note> {
    const note = await this.get(id)
    await this.deps.notes.delete(id)
    return note
  }

  private async assertCanHoldNotes(nodeId: string): Promise<void> {
    const node = await this.deps.nodes.findById(nodeId)
    if (!node) throw new NotFoundError("Node", nodeId)
    if (!canHoldNotes(node.kind)) {
      throw new InvariantViolation("Cards belong to branches or leaves, not trees")
    }
  }
}

export function directionsFor(reversible: boolean): CardDirection[] {
  return reversible ? ["forward", "reverse"] : ["forward"]
}

function normalise({ frontMd, backMd, reversible }: NoteContent): NoteContent {
  const front = frontMd.trim()
  const back = backMd.trim()
  if (!front || !back)
    throw new InvariantViolation("Both the front and back of a card are required")
  return { frontMd: front, backMd: back, reversible }
}
