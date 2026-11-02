import type { Database, DbExecutor } from "../../db/types"
import type { Repositories, UnitOfWork } from "../interfaces"
import { DrizzleCardRepository } from "./card-repository"
import { DrizzleNodeRepository } from "./node-repository"
import { DrizzleNoteRepository } from "./note-repository"
import { DrizzleReviewLogRepository } from "./review-log-repository"
import { DrizzleSettingsRepository } from "./settings-repository"

export function createDrizzleRepositories(db: DbExecutor): Repositories {
  return {
    nodes: new DrizzleNodeRepository(db),
    notes: new DrizzleNoteRepository(db),
    cards: new DrizzleCardRepository(db),
    reviewLogs: new DrizzleReviewLogRepository(db),
    settings: new DrizzleSettingsRepository(db),
  }
}

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createDrizzleRepositories(tx)))
  }
}
