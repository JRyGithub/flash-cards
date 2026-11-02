import { asc, eq, inArray } from "drizzle-orm"

import type { DbExecutor } from "../../db/types"
import { notes } from "../../db/schema"
import { NotFoundError } from "../../domain/errors"
import type { Note } from "../../domain/types"
import type { NewNote, NoteRepository } from "../interfaces"

export class DrizzleNoteRepository implements NoteRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string): Promise<Note | null> {
    const [row] = await this.db.select().from(notes).where(eq(notes.id, id))
    return row ?? null
  }

  listByNode(nodeId: string): Promise<Note[]> {
    return this.db
      .select()
      .from(notes)
      .where(eq(notes.nodeId, nodeId))
      .orderBy(asc(notes.createdAt), asc(notes.id))
  }

  async listByNodes(nodeIds: readonly string[]): Promise<Note[]> {
    if (nodeIds.length === 0) return []
    return this.db
      .select()
      .from(notes)
      .where(inArray(notes.nodeId, [...nodeIds]))
  }

  async createMany(input: readonly NewNote[]): Promise<Note[]> {
    if (input.length === 0) return []
    return this.db
      .insert(notes)
      .values([...input])
      .returning()
  }

  async update(
    id: string,
    patch: Partial<Pick<Note, "frontMd" | "backMd" | "reversible">>,
  ): Promise<Note> {
    const [row] = await this.db.update(notes).set(patch).where(eq(notes.id, id)).returning()
    if (!row) throw new NotFoundError("Note", id)
    return row
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id))
  }
}
