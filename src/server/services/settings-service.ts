import { ValidationError } from "../domain/errors"
import { isValidTimeZone } from "../domain/time"
import type { Settings } from "../domain/types"
import type { SettingsRepository } from "../repositories/interfaces"

export class SettingsService {
  constructor(private readonly deps: { settings: SettingsRepository }) {}

  get(): Promise<Settings> {
    return this.deps.settings.get()
  }

  update(patch: Partial<Omit<Settings, "fsrsWeights">>): Promise<Settings> {
    if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) {
      throw new ValidationError(`Unknown time zone "${patch.timezone}"`)
    }
    return this.deps.settings.update(patch)
  }
}
