import { and, asc, count, eq, getTableColumns, inArray, lt, min, sql } from "drizzle-orm"

import type { DbExecutor } from "../../db/types"
import { cards, notes } from "../../db/schema"
import { NotFoundError } from "../../domain/errors"
import { type Card, type CardDirection, CardState, type DueCounts } from "../../domain/types"
import type { SchedulingState } from "../../domain/types"
import type { CardRepository, DueWindow, NewCard } from "../interfaces"

const LEARNING_STATES = [CardState.Learning, CardState.Relearning]

export class DrizzleCardRepository implements CardRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string): Promise<Card | null> {
    const [row] = await this.db.select().from(cards).where(eq(cards.id, id))
    return row ?? null
  }

  async listByNotes(noteIds: readonly string[]): Promise<Card[]> {
    if (noteIds.length === 0) return []
    return this.db
      .select()
      .from(cards)
      .where(inArray(cards.noteId, [...noteIds]))
  }

  async createMany(input: readonly NewCard[]): Promise<Card[]> {
    if (input.length === 0) return []
    return this.db
      .insert(cards)
      .values(
        input.map(({ id, noteId, direction, scheduling }) => ({
          id,
          noteId,
          direction,
          ...scheduling,
        })),
      )
      .returning()
  }

  async updateScheduling(id: string, scheduling: SchedulingState): Promise<Card> {
    const [row] = await this.db.update(cards).set(scheduling).where(eq(cards.id, id)).returning()
    if (!row) throw new NotFoundError("Card", id)
    return row
  }

  async deleteByNoteAndDirection(noteId: string, direction: CardDirection): Promise<void> {
    await this.db.delete(cards).where(and(eq(cards.noteId, noteId), eq(cards.direction, direction)))
  }

  findLearningDue(nodeIds: readonly string[], before: Date, limit: number): Promise<Card[]> {
    return this.inNodes(
      nodeIds,
      and(inArray(cards.state, LEARNING_STATES), lt(cards.dueAt, before)),
      limit,
    )
  }

  findReviewDue(nodeIds: readonly string[], before: Date, limit: number): Promise<Card[]> {
    return this.inNodes(
      nodeIds,
      and(eq(cards.state, CardState.Review), lt(cards.dueAt, before)),
      limit,
    )
  }

  findNew(nodeIds: readonly string[], limit: number): Promise<Card[]> {
    return this.inNodes(nodeIds, eq(cards.state, CardState.New), limit, [
      asc(notes.createdAt),
      asc(notes.id),
      asc(cards.direction),
    ])
  }

  async countDueByNode(window: DueWindow): Promise<Map<string, DueCounts>> {
    const rows = await this.db
      .select({
        nodeId: notes.nodeId,
        new: sql<number>`count(*) filter (where ${eq(cards.state, CardState.New)})`.mapWith(Number),
        learning: sql<number>`count(*) filter (where ${and(
          inArray(cards.state, LEARNING_STATES),
          lt(cards.dueAt, window.learnAheadUntil),
        )})`.mapWith(Number),
        review: sql<number>`count(*) filter (where ${and(
          eq(cards.state, CardState.Review),
          lt(cards.dueAt, window.endOfDay),
        )})`.mapWith(Number),
      })
      .from(cards)
      .innerJoin(notes, eq(notes.id, cards.noteId))
      .groupBy(notes.nodeId)
    return new Map(rows.map(({ nodeId, ...counts }) => [nodeId, counts]))
  }

  async countByNode(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ nodeId: notes.nodeId, total: count() })
      .from(cards)
      .innerJoin(notes, eq(notes.id, cards.noteId))
      .groupBy(notes.nodeId)
    return new Map(rows.map(({ nodeId, total }) => [nodeId, total]))
  }

  async nextLearningDueAt(nodeIds: readonly string[]): Promise<Date | null> {
    if (nodeIds.length === 0) return null
    const [row] = await this.db
      .select({ next: min(cards.dueAt) })
      .from(cards)
      .innerJoin(notes, eq(notes.id, cards.noteId))
      .where(and(inArray(notes.nodeId, [...nodeIds]), inArray(cards.state, LEARNING_STATES)))
    return row?.next ?? null
  }

  private async inNodes(
    nodeIds: readonly string[],
    where: ReturnType<typeof and>,
    limit: number,
    orderBy = [asc(cards.dueAt), asc(cards.id)],
  ): Promise<Card[]> {
    if (nodeIds.length === 0 || limit <= 0) return []
    return this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(notes, eq(notes.id, cards.noteId))
      .where(and(inArray(notes.nodeId, [...nodeIds]), where))
      .orderBy(...orderBy)
      .limit(limit)
  }
}
