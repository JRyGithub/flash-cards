import { asc, gte, inArray, sql } from "drizzle-orm"

import type { DbExecutor } from "../../db/types"
import { reviewLogs } from "../../db/schema"
import { CardState, type ReviewLog } from "../../domain/types"
import type { NewReviewLog, ReviewLogRepository } from "../interfaces"

export class DrizzleReviewLogRepository implements ReviewLogRepository {
  constructor(private readonly db: DbExecutor) {}

  async create(input: NewReviewLog): Promise<void> {
    await this.db.insert(reviewLogs).values(input)
  }

  async createMany(input: readonly NewReviewLog[]): Promise<void> {
    if (input.length === 0) return
    await this.db.insert(reviewLogs).values([...input])
  }

  async listByCards(cardIds: readonly string[]): Promise<ReviewLog[]> {
    if (cardIds.length === 0) return []
    return this.db
      .select()
      .from(reviewLogs)
      .where(inArray(reviewLogs.cardId, [...cardIds]))
      .orderBy(asc(reviewLogs.reviewedAt))
  }

  async countSince(since: Date): Promise<{ newIntroduced: number; reviewsDone: number }> {
    const [row] = await this.db
      .select({
        newIntroduced:
          sql<number>`count(*) filter (where ${reviewLogs.state} = ${CardState.New})`.mapWith(
            Number,
          ),
        reviewsDone:
          sql<number>`count(*) filter (where ${reviewLogs.state} = ${CardState.Review})`.mapWith(
            Number,
          ),
      })
      .from(reviewLogs)
      .where(gte(reviewLogs.reviewedAt, since))
    return { newIntroduced: row?.newIntroduced ?? 0, reviewsDone: row?.reviewsDone ?? 0 }
  }
}
