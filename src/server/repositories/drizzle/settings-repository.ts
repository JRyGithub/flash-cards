import { eq } from "drizzle-orm"

import type { DbExecutor } from "../../db/types"
import { type SettingsRow, settings } from "../../db/schema"
import type { Settings } from "../../domain/types"
import type { SettingsRepository } from "../interfaces"

const SINGLETON_ID = 1

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: DbExecutor) {}

  async get(): Promise<Settings> {
    const [row] = await this.db.select().from(settings).where(eq(settings.id, SINGLETON_ID))
    if (row) return toSettings(row)
    const [created] = await this.db
      .insert(settings)
      .values({ id: SINGLETON_ID })
      .onConflictDoNothing()
      .returning()
    return created ? toSettings(created) : this.get()
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    await this.get()
    const [row] = await this.db
      .update(settings)
      .set(patch)
      .where(eq(settings.id, SINGLETON_ID))
      .returning()
    return toSettings(row!)
  }
}

function toSettings({ id: _id, updatedAt: _updatedAt, ...rest }: SettingsRow): Settings {
  return rest
}
